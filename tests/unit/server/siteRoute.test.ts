import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerPublicRoutes } from '../../../src/server/routes/public';
import type { AppEnv } from '../../../src/server/types';

describe('public site settings route', () => {
  it('returns validated public settings without becoming a website dependency', async () => {
    const statement = {
      first: vi.fn().mockResolvedValue({
        analytics_measurement_id: null,
        contact_address: null,
        contact_email: null,
        contact_phone: null,
        default_language: 'fr',
        enabled_languages: '["fr","en"]',
        enabled_services: '["wedding","family","brand","corporate","children"]',
        construction_notice_enabled: 1,
        home_galleries_enabled: 1,
        home_galleries_limit: 6,
        home_hero_image_revision: 4,
        home_hero_image_medium_width: 1280,
        home_hero_image_large_width: 2560,
        map_center_latitude: null,
        map_center_longitude: null,
        map_radius_km: null,
        service_area: null,
        site_name: 'Cadrora',
        theme_mode: 'both',
        updated_at: '2026-09-20T00:00:00.000Z',
      }),
    };
    const database = { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', cacheHeaders);
    registerPublicRoutes(app);

    const response = await app.request('/api/v1/site', undefined, { DB: database });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    await expect(response.json()).resolves.toEqual({
      aboutCopy: null,
      aboutEnabled: true,
      aboutImageRevision: null,
      aboutImageMediumWidth: null,
      aboutImageLargeWidth: null,
      analyticsMeasurementId: null,
      contactAddress: null,
      contactEmail: null,
      contactPhone: null,
      defaultLanguage: 'fr',
      enabledLanguages: ['fr', 'en'],
      enabledServices: ['wedding', 'family', 'brand', 'corporate', 'children'],
      constructionNoticeEnabled: true,
      galleryDirectoryEnabled: true,
      sessionsPageEnabled: true,
      homeGalleries: { enabled: true, limit: 6 },
      homeHeroCopy: null,
      homeHeroImageRevision: 4,
      homeHeroImageMediumWidth: 1280,
      homeHeroImageLargeWidth: 2560,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      serviceArea: null,
      siteName: 'Cadrora',
      siteCopy: null,
      themeMode: 'both',
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
  });
});
