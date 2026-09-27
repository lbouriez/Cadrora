import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerServiceRoutes } from '../../../src/server/routes/services';
import type { AppEnv } from '../../../src/server/types';
import { ServiceCardsSchema } from '../../../src/shared/schemas/services';

function testApp(withAnonymousAuth = false) {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  if (withAnonymousAuth) app.use('*', async (context, next) => { context.set('auth', {}); await next(); });
  registerServiceRoutes(app);
  return app;
}

describe('service catalog routes', () => {
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

  it('publishes only enabled complete cards and emits versioned D1-derived image URLs', async () => {
    const rows = [
      { id: 'wedding', is_builtin: 1, sort_order: 0, enabled: 1, show_on_home: 1, copy_json: null, image_revision: 0 },
      { id: 'custom', is_builtin: 0, sort_order: 1, enabled: 1, show_on_home: 1,
        copy_json: JSON.stringify({ fr: { title: 'Studio', shortDescription: 'Court', description: 'Long', points: [] }, en: { title: 'Studio', shortDescription: 'Short', description: 'Long', points: [] } }),
        image_revision: 1 },
      { id: 'draft', is_builtin: 0, sort_order: 2, enabled: 1, show_on_home: 1,
        copy_json: JSON.stringify({ fr: { title: 'Brouillon', shortDescription: 'Court', description: 'Long', points: [] }, en: { title: 'Draft', shortDescription: 'Short', description: 'Long', points: [] } }),
        image_revision: 0 },
    ];
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
