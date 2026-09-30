import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { createAdminSiteRoutes } from '../../../src/server/routes/admin/site';
import { AdminSiteSettingsSchema } from '../../../src/shared/schemas';
import type { AppEnv } from '../../../src/server/types';

const row = {
  analytics_measurement_id: null,
  contact_address: null,
  contact_email: null,
  contact_phone: null,
  default_language: 'fr' as const,
  enabled_languages: '["fr","en"]',
  enabled_services: '["wedding","family","brand","corporate","children"]',
  construction_notice_enabled: 0,
  home_galleries_enabled: 1,
  home_galleries_limit: 6,
  map_center_latitude: null,
  map_center_longitude: null,
  map_radius_km: null,
  service_area: null,
  site_name: 'Cadrora',
  site_copy: null,
  theme_mode: 'both' as const,
  updated_at: '2026-09-21T00:00:00.000Z',
};

const quotaBindings = {
  MAX_FACES_PER_EVENT: '10000',
  MAX_STORAGE_BYTES: '9900000000',
  MAX_TOTAL_FACES: '39000',
};

function appWith() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', async (context, next) => {
    context.set('auth', {
      admin: {
        access: 'manage',
        authMode: 'password',
        createdAt: row.updated_at,
        expiresAt: '2026-09-21T08:00:00.000Z',
        id: 'owner',
        revokedAt: null,
        subject: 'owner',
      },
    });
    await next();
  });
  app.route('/api/v1/admin', createAdminSiteRoutes());
  return app;
}

describe('admin site settings routes', () => {
  it('allows hiding Galleries once public galleries are unlisted, draft, or offline', async () => {
    let blockingPublicGallery = true;
    let directoryEnabled = 1;
    let noticeEnabled = 0;
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({
        run: () => {
          directoryEnabled = Number(values.at(-2));
          noticeEnabled = Number(values.at(-1));
          return Promise.resolve({ meta: { changes: 1 } });
        },
      }),
      first: () => Promise.resolve(query.includes('FROM events')
        ? blockingPublicGallery ? { id: 'public-online' } : null
        : query.startsWith('SELECT site_name') ? { ...row, gallery_directory_enabled: directoryEnabled, construction_notice_enabled: noticeEnabled }
          : query.includes('owner_storage_limit_bytes') ? { owner_storage_limit_bytes: null, owner_face_limit: null }
            : { value: 0 }),
    }));
    const database = { prepare } as unknown as D1Database;
    const input = {
      analyticsMeasurementId: null, contactAddress: null, contactEmail: null, contactPhone: null,
      defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'], enabledServices: ['wedding'],
      constructionNoticeEnabled: true, galleryDirectoryEnabled: false, homeGalleries: { enabled: true, limit: 6 },
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      quotas: { faceLimit: 39000, storageLimitBytes: 9900000000 }, serviceArea: null,
      siteName: 'Atelier Giulia', themeMode: 'both',
    };
    const save = () => appWith().request('/api/v1/admin/site', {
      body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' }, method: 'PATCH',
    }, { DB: database, ...quotaBindings });

    const blocked = await save();
    expect(blocked.status).toBe(409);
    expect(directoryEnabled).toBe(1);
    blockingPublicGallery = false;
    const saved = await save();
    expect(saved.status).toBe(200);
    expect(AdminSiteSettingsSchema.parse(await saved.json()).galleryDirectoryEnabled).toBe(false);
    expect(noticeEnabled).toBe(1);
    const reread = await appWith().request('/api/v1/admin/site', undefined, { DB: database, ...quotaBindings });
    expect(AdminSiteSettingsSchema.parse(await reread.json()).constructionNoticeEnabled).toBe(true);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("visibility = 'published' AND offline_at IS NULL"));
  });

  it('saves bilingual Home introduction and resets its copy and photo selection', async () => {
    let current = { ...row, home_hero_copy: null as string | null, home_hero_image_revision: 3 as number | null };
    const writes: string[] = [];
    const database = {
      prepare: vi.fn((query: string) => ({
        bind: (...values: unknown[]) => ({
          first: () => Promise.resolve(query.includes('FROM site_services WHERE id = ?')
            ? { image_revision: 3, pending_image_revision: null }
            : query.includes('FROM site_service_variants') ? null
              : null),
          all: () => Promise.resolve({ results: [] }),
          run: () => {
            writes.push(query);
            if (query.includes('SET home_hero_copy = ?')) current = { ...current, home_hero_copy: String(values[0]) };
            return Promise.resolve({ meta: { changes: 1 } });
          },
          query,
        }),
        first: () => Promise.resolve(query.includes('SELECT site_name') ? current
          : query.includes('owner_storage_limit_bytes') ? { owner_storage_limit_bytes: null, owner_face_limit: null }
            : { value: 0 }),
      })),
      batch: vi.fn((statements: { query: string }[]) => {
        writes.push(...statements.map((statement) => statement.query));
        current = { ...current, home_hero_copy: null, home_hero_image_revision: null };
        return Promise.resolve([]);
      }),
    } as unknown as D1Database;
    const copy = {
      fr: { label: 'Images précieuses', title: 'Votre histoire', description: 'Des photos attentives.', caption: '', imageAlt: 'Un couple souriant' },
      en: { label: 'Precious images', title: 'Your story', description: 'Thoughtful photography.', caption: '', imageAlt: 'A smiling couple' },
      buttons: [
        { labels: { fr: 'Écrivez-nous', en: 'Contact us' }, href: '/contact', variant: 'primary' },
        { labels: { fr: 'Services', en: 'Services' }, href: '#services', variant: 'secondary' },
        { labels: { fr: 'Galeries', en: 'Galleries' }, href: '/galleries', variant: 'secondary' },
      ],
    };
    const app = appWith();
    const saved = await app.request('/api/v1/admin/site/home-hero', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy),
    }, { DB: database, ...quotaBindings });
    expect(saved.status).toBe(200);
    expect(AdminSiteSettingsSchema.parse(await saved.json()).homeHeroCopy).toEqual(copy);
    const reset = await app.request('/api/v1/admin/site/home-hero/reset', { method: 'POST' }, { DB: database, ...quotaBindings });
    expect(reset.status).toBe(200);
    expect(AdminSiteSettingsSchema.parse(await reset.json()).homeHeroCopy).toBeNull();
    expect(writes.some((query) => query.includes('home_hero_image_enabled = 0'))).toBe(true);
  });

  it('returns and persists the public theme mode for an owner', async () => {
    const siteSelect = { first: vi.fn().mockResolvedValue(row) };
    const countSelect = { first: vi.fn().mockResolvedValue({ value: 0 }) };
    const update = { bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
    const database = {
      prepare: vi.fn((query: string) => query.startsWith('UPDATE') ? update :
        query.includes('usage_counters') || query.includes('COUNT(*)') ? countSelect : siteSelect),
    } as unknown as D1Database;
    const app = appWith();

    await expect((await app.request('/api/v1/admin/site', undefined, { DB: database, ...quotaBindings })).json()).resolves.toMatchObject({
      quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
      quotas: { faceLimit: 39000, storageLimitBytes: 9900000000 },
      themeMode: 'both',
      homeGalleries: { enabled: true, limit: 6 },
    });
    const response = await app.request('/api/v1/admin/site', {
      body: JSON.stringify({
        analyticsMeasurementId: 'G-ABCDEF1234',
        contactAddress: 'Montréal, Québec',
        contactEmail: 'bonjour@example.test',
        contactPhone: '+1 514 555-0142',
        defaultLanguage: 'en',
        enabledLanguages: ['en'],
        enabledServices: ['wedding', 'corporate'],
        galleryDirectoryEnabled: true,
        homeGalleries: { enabled: false, limit: 4 },
        map: { centerLatitude: 45.5019, centerLongitude: -73.5674, radiusKm: 125 },
        quotas: { faceLimit: 2000, storageLimitBytes: 1000000000 },
        serviceArea: 'Greater Montréal',
        siteName: 'Studio North',
        siteCopy: {
          fr: { description: 'Studio du Nord.', footerTagline: 'Des souvenirs durables.' },
          en: { description: 'Northern studio.', footerTagline: 'Memories that last.' },
        },
        themeMode: 'system',
      }),
      headers: { 'Content-Type': 'application/json', Origin: 'https://cadrora.test' },
      method: 'PATCH',
    }, { DB: database, ...quotaBindings });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith(
      'en', '["en"]', 'system', 1000000000, 2000, 'G-ABCDEF1234',
      'bonjour@example.test', '+1 514 555-0142', 'Montréal, Québec', 'Greater Montréal',
      45.5019, -73.5674, 125, '["wedding","corporate"]', 'Studio North', 0, 4,
      JSON.stringify({ fr: { description: 'Studio du Nord.', footerTagline: 'Des souvenirs durables.' }, en: { description: 'Northern studio.', footerTagline: 'Memories that last.' } }),
      expect.any(String),
      1,
      null,
    );
  });

  it('refuses owner limits above the deployment guardrails', async () => {
    const prepare = vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(row),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    }));
    const database = {
      prepare,
    } as unknown as D1Database;

    const response = await appWith().request('/api/v1/admin/site', {
      body: JSON.stringify({
        analyticsMeasurementId: null,
        contactAddress: null,
        contactEmail: null,
        contactPhone: null,
        defaultLanguage: 'fr',
        enabledLanguages: ['fr'],
        enabledServices: ['wedding'],
        homeGalleries: { enabled: true, limit: 6 },
        map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
        quotas: { faceLimit: 39001, storageLimitBytes: 1000000000 },
        serviceArea: null,
        siteName: 'Cadrora',
        themeMode: 'light',
      }),
      headers: { 'Content-Type': 'application/json', Origin: 'https://cadrora.test' },
      method: 'PATCH',
    }, { DB: database, ...quotaBindings });

    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
});
