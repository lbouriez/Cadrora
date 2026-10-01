import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerServiceRoutes } from '../../../src/server/routes/services';
import type { AppEnv } from '../../../src/server/types';
import { ServiceCardsSchema, ServiceCardUpdateSchema, ServiceImageUploadHeadersSchema } from '../../../src/shared/schemas/services';

function testApp(withAnonymousAuth = false, withOwnerAuth = false, access: 'manage' | 'read-only' = 'manage') {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  if (withAnonymousAuth) app.use('*', async (context, next) => { context.set('auth', {}); await next(); });
  if (withOwnerAuth) app.use('*', async (context, next) => {
    context.set('auth', { admin: {
      access, authMode: 'password', createdAt: '2026-09-27T00:00:00.000Z',
      expiresAt: '2026-09-28T00:00:00.000Z', id: 'owner', revokedAt: null, subject: 'owner',
    } });
    await next();
  });
  registerServiceRoutes(app);
  return app;
}

describe('service catalog routes', () => {
  it('validates alignment choices while accepting older clients without framing fields', () => {
    const input = { enabled: true, showOnHome: true, sortOrder: 0, copy: null };
    expect(ServiceCardUpdateSchema.parse(input)).toEqual(input);
    expect(ServiceCardUpdateSchema.safeParse({ ...input, photoAlignment: 'top', mobilePhotoAlignment: 'bottom' }).success).toBe(true);
    expect(ServiceCardUpdateSchema.safeParse({ ...input, mobilePhotoAlignment: 'javascript:bad' }).success).toBe(false);
  });

  it('persists framing, preserves it on reorder, and clears only an explicitly removed phone override', async () => {
    const row = { id: 'maternity', is_builtin: 1, sort_order: 0, enabled: 1, show_on_home: 1,
      copy_json: null, image_revision: 0, pending_image_revision: null,
      photo_alignment: 'center', mobile_photo_alignment: null as string | null };
    const updates: unknown[][] = [];
    const database = { prepare: vi.fn((query: string) => ({
      all: () => Promise.resolve({ results: query.includes('FROM site_services') ? [row] : [] }),
      bind: (...values: unknown[]) => ({
        first: () => Promise.resolve(row),
        run: () => {
          if (query.startsWith('UPDATE site_services')) {
            updates.push(values);
            row.photo_alignment = String(values[4]);
            row.mobile_photo_alignment = typeof values[5] === 'string' ? values[5] : null;
          }
          return Promise.resolve({ success: true });
        },
      }),
    })) } as unknown as D1Database;
    const input = { enabled: true, showOnHome: true, sortOrder: 0, copy: null };
    const patch = (body: unknown) => testApp(false, true).request('/api/v1/admin/services/maternity', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, { DB: database });
    expect(await (await patch({ ...input, photoAlignment: 'left', mobilePhotoAlignment: 'right' })).json())
      .toMatchObject({ photoAlignment: 'left', mobilePhotoAlignment: 'right' });
    expect(await (await patch({ ...input, sortOrder: 1 })).json())
      .toMatchObject({ photoAlignment: 'left', mobilePhotoAlignment: 'right' });
    const publicCards = await testApp().request('/api/v1/services', undefined, { DB: database });
    expect(await publicCards.json()).toMatchObject([{ photoAlignment: 'left', mobilePhotoAlignment: 'right' }]);
    expect(await (await patch({ ...input, mobilePhotoAlignment: null })).json())
      .toMatchObject({ photoAlignment: 'left', mobilePhotoAlignment: null });
    expect(updates).toHaveLength(3);
    expect((await patch({ ...input, photoAlignment: 'invalid' })).status).toBe(400);
    expect(updates).toHaveLength(3);
  });

  it.each(['anonymous', 'read-only'] as const)('rejects %s framing writes before touching D1', async (role) => {
    const prepare = vi.fn();
    const app = role === 'anonymous' ? testApp(true) : testApp(false, true, 'read-only');
    const response = await app.request('/api/v1/admin/services/maternity', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, showOnHome: true, sortOrder: 0, copy: null, photoAlignment: 'right' }),
    }, { DB: { prepare } as unknown as D1Database });
    expect(response.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('accepts the dimensions of a 2560 px wide portrait marketing image', () => {
    expect(ServiceImageUploadHeadersSchema.safeParse({
      byteSize: 3_000_000, checksumSha256: 'a'.repeat(64), contentType: 'image/webp',
      width: 2560, height: 4551,
    }).success).toBe(true);
  });

  it('restores a built-in card’s example copy and photo while preserving its visibility and revision counter', async () => {
    const copy = { fr: { title: 'Mariages', shortDescription: 'Court', description: 'Long', points: [] },
      en: { title: 'Weddings', shortDescription: 'Short', description: 'Long', points: [] } };
    const row: { id: string; is_builtin: number; sort_order: number; enabled: number; show_on_home: number;
      copy_json: string | null; image_revision: number; pending_image_revision: number | null; photo_alignment: string; mobile_photo_alignment: string | null } = {
      id: 'wedding', is_builtin: 1, sort_order: 2, enabled: 1, show_on_home: 0,
      copy_json: JSON.stringify(copy), image_revision: 3, pending_image_revision: 4, photo_alignment: 'right', mobile_photo_alignment: 'left' };
    let variants = [3, 4].map((revision) => ({ service_id: 'wedding', revision,
      variant: 'preview', storage_key: `site/services/wedding/${revision}/preview.webp`,
      content_type: 'image/webp', byte_size: 100, width: 320, height: 213, checksum_sha256: 'a'.repeat(64) }));
    const batched: string[] = [];
    const database = {
      prepare: vi.fn((query: string) => ({
        query,
        all: () => Promise.resolve({ results: query.includes('FROM site_services') ? [row] : variants }),
        bind: (...values: unknown[]) => ({
          query,
          values,
          first: () => Promise.resolve(query.includes('FROM site_services') ? row : null),
          all: () => Promise.resolve({ results: variants.filter((variant) =>
            variant.revision === values[1]).map((variant) => ({ storage_key: variant.storage_key })) }),
        }),
      })),
      batch: vi.fn((statements: { query: string; values?: unknown[] }[]) => {
        batched.push(...statements.map((statement) => statement.query));
        const reset = statements.find((statement) => statement.query.includes('copy_json = NULL'));
        if (reset) {
          row.copy_json = null;
          row.photo_alignment = 'center';
          row.mobile_photo_alignment = null;
          row.image_revision = Number(reset.values?.[0]);
          row.pending_image_revision = null;
          variants = [];
        }
        const newRevision = statements.find((statement) => statement.query.includes('SET pending_image_revision = ?'));
        if (newRevision) row.pending_image_revision = Number(newRevision.values?.[0]);
        return Promise.resolve([]);
      }),
    } as unknown as D1Database;
    const response = await testApp(false, true).request('/api/v1/admin/services/wedding/reset', { method: 'POST' }, { DB: database });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 'wedding', enabled: true, showOnHome: false, sortOrder: 2, copy: null,
      imageRevision: null, imageSources: [], photoAlignment: 'center', mobilePhotoAlignment: null,
    });
    expect(batched.filter((query) => query.includes("'delete_service_media'"))).toHaveLength(2);
    expect(batched.filter((query) => query.startsWith('DELETE FROM site_service_variants'))).toHaveLength(2);
    expect(batched.some((query) => query.includes('copy_json = NULL'))).toBe(true);
    const nextUpload = await testApp(false, true).request('/api/v1/admin/services/wedding/image-revision', { method: 'POST' }, { DB: database });
    expect(await nextUpload.json()).toEqual({ revision: 5 });
  });

  it('rejects example reset for a custom service', async () => {
    const batch = vi.fn();
    const database = { prepare: vi.fn(() => ({ bind: () => ({ first: () => Promise.resolve({ is_builtin: 0 }) }) })), batch } as unknown as D1Database;
    const response = await testApp(false, true).request('/api/v1/admin/services/custom/reset', { method: 'POST' }, { DB: database });
    expect(response.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  it('serves the compiled Home photo when D1 is unavailable', async () => {
    const assetFetch = vi.fn().mockResolvedValue(new Response('default-photo', { headers: { 'Content-Type': 'image/webp' } }));
    const database = { prepare: vi.fn(() => ({ bind: () => ({ first: () => Promise.reject(new Error('D1 unavailable')) }) })) } as unknown as D1Database;
    const response = await testApp().request('/home-hero-image/small', undefined, {
      ASSETS: { fetch: assetFetch }, DB: database, SITE_HERO_IMAGE_URL: '/brand/demo-hero.webp',
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('default-photo');
    expect(assetFetch).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://localhost/brand/responsive/demo-hero-640.webp' }));
  });

  it('streams only the currently published Home photo variant from private R2', async () => {
    const object = { body: new Response('owner-photo').body, size: 11, httpEtag: '"hero"' };
    const get = vi.fn().mockResolvedValue(object);
    const database = { prepare: vi.fn(() => ({ bind: () => ({ first: () => Promise.resolve({
      storage_key: 'site/services/home-hero/3/medium.webp', content_type: 'image/webp',
      byte_size: 11, checksum_sha256: 'a'.repeat(64), revision: 3,
    }) }) })) } as unknown as D1Database;
    const response = await testApp().request('/home-hero-image/medium', undefined, {
      DB: database, MEDIA_BUCKET: { get }, SITE_HERO_IMAGE_URL: '/brand/demo-hero.webp',
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('owner-photo');
    expect(get).toHaveBeenCalledWith('site/services/home-hero/3/medium.webp');
  });

  it('does not expose an uploaded About photo when the page is disabled', async () => {
    const prepare = vi.fn(() => ({ bind: () => ({ first: () => Promise.resolve(null) }) }));
    const database = { prepare } as unknown as D1Database;
    const get = vi.fn();
    const response = await testApp().request('/service-media/about-hero/3/large', undefined, {
      DB: database, MEDIA_BUCKET: { get },
    });
    expect(response.status).toBe(404);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('settings.about_enabled = 1'));
    expect(get).not.toHaveBeenCalled();
  });

  it('publishes complete cards visible on either page and emits versioned D1-derived image URLs', async () => {
    const rows = [
      { id: 'wedding', is_builtin: 1, sort_order: 0, enabled: 1, show_on_home: 1, copy_json: null, image_revision: 0 },
      { id: 'custom', is_builtin: 0, sort_order: 1, enabled: 0, show_on_home: 1,
        copy_json: JSON.stringify({ fr: { title: 'Studio', shortDescription: 'Court', description: 'Long', points: [] }, en: { title: 'Studio', shortDescription: 'Short', description: 'Long', points: [] } }),
        image_revision: 1 },
      { id: 'draft', is_builtin: 0, sort_order: 2, enabled: 1, show_on_home: 1,
        copy_json: JSON.stringify({ fr: { title: 'Brouillon', shortDescription: 'Court', description: 'Long', points: [] }, en: { title: 'Draft', shortDescription: 'Short', description: 'Long', points: [] } }),
        image_revision: 0 },
    ];
    rows.push({ ...rows[0]!, id: 'hidden', enabled: 0, show_on_home: 0 });
    const variants = ['preview', 'small', 'medium', 'large'].map((variant, index) => ({
      service_id: 'custom', revision: 1, variant, storage_key: `site/services/custom/1/${variant}.webp`,
      content_type: 'image/webp', byte_size: 100, width: [320, 640, 960, 1280][index], height: [213, 427, 640, 853][index],
      checksum_sha256: 'a'.repeat(64),
    }));
    const database = { prepare: vi.fn((sql: string) => ({
      all: vi.fn().mockResolvedValue({ results: sql.includes('FROM site_services') ? rows : variants }),
    })) } as unknown as D1Database;

    const response = await testApp().request('/api/v1/services', undefined, { DB: database });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    const cards = ServiceCardsSchema.parse(await response.json());
    expect(cards.map((card) => card.id)).toEqual(['wedding', 'custom']);
    expect(cards[1]?.imageSources.map((source) => source.url)).toEqual([
      '/service-media/custom/1/preview', '/service-media/custom/1/small',
      '/service-media/custom/1/medium', '/service-media/custom/1/large',
    ]);
  });

  it.each([true, false])('rejects incomplete custom publication with Sessions selected=%s and Home selected', async (enabled) => {
    const run = vi.fn();
    const row = { id: 'custom', is_builtin: 0, image_revision: 0 };
    const database = { prepare: vi.fn(() => ({ bind: () => ({ first: () => Promise.resolve(row), run }) })) } as unknown as D1Database;
    const response = await testApp(false, true).request('/api/v1/admin/services/custom', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, showOnHome: true, sortOrder: 0, copy: null }),
    }, { DB: database });
    expect(response.status).toBe(409);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects admin service writes without a verified owner before touching D1', async () => {
    const app = testApp(true);
    const prepare = vi.fn();
    const response = await app.request('/api/v1/admin/services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }, { DB: { prepare } as unknown as D1Database });
    expect(response.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });
});
