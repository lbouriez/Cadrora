import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOME_IMAGE_MARKER, homeImageDocument, readHomeImageDocument } from '../../../src/server/http/homeImageDocument';
import { registerHomeDocumentRoutes } from '../../../src/server/routes/homeDocument';
import type { AppEnv } from '../../../src/server/types';

const settings = {
  siteName: 'Owner studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null }, enabledServices: ['wedding'],
  homeGalleries: { enabled: false, limit: 6 }, analyticsMeasurementId: null, themeMode: 'both', updatedAt: '2026-11-03T00:00:00.000Z',
};
const template = `<html><head>${HOME_IMAGE_MARKER}</head><body>Static fallback</body></html>`;
afterEach(() => vi.useRealTimers());

describe('optional owner-resolved Home document', () => {
  it('selects the published owner revision without hinting any compiled fallback', () => {
    const html = homeImageDocument(template, { ...settings, homeHeroImageRevision: 8, homeHeroImageMediumWidth: 1100, homeHeroImageLargeWidth: 2200 });
    expect(html).toContain('imagesrcset="/service-media/home-hero/8/preview 320w, /service-media/home-hero/8/small 640w, /service-media/home-hero/8/medium 1100w, /service-media/home-hero/8/large 2200w"');
    expect(html).toContain('imagesizes="95vw"');
    expect(html).not.toContain('/home-hero-image/');
    expect(html.match(/data-home-photo-preload/gu)).toHaveLength(1);
  });
  it('hints the compiled image only after a valid settings read confirms no owner revision', () => {
    expect(homeImageDocument(template, settings)).toContain('/home-hero-image/small 640w');
    for (const value of [null, {}, { ...settings, homeHeroImageRevision: 3 }, { ...settings, defaultLanguage: 'xx' }]) {
      expect(homeImageDocument(template, value)).toBe(template);
    }
  });
  it('escapes the validated public snapshot without serializing extra private fields', () => {
    const html = homeImageDocument(template, { ...settings, siteName: '</script><script>alert("$&")</script>', secret: 'never-serialize' });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('never-serialize');
    const json = /type="application\/json">([\s\S]*?)<\/script>/u.exec(html)?.[1] ?? '';
    expect(JSON.parse(json)).toMatchObject({ siteName: '</script><script>alert("$&")</script>' });
  });
  it('leaves profiles without the marker unchanged without accessing D1', async () => {
    const prepare = vi.fn();
    const env = { DB: { prepare } } as unknown as CloudflareBindings;
    expect(await readHomeImageDocument('<html>Atelier</html>', env)).toBe('<html>Atelier</html>');
    expect(prepare).not.toHaveBeenCalled();
  });
  it('bounds a stalled D1 read and returns the original static shell after 250ms', async () => {
    vi.useFakeTimers();
    const env = { DB: { prepare: () => ({ first: () => new Promise(() => {}) }) } } as unknown as CloudflareBindings;
    const pending = readHomeImageDocument(template, env);
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toBe(template);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('contains failures and invalid D1 rows without blocking the public Home', async () => {
    for (const first of [() => Promise.reject(new Error('offline')), () => Promise.resolve({ site_name: 'incomplete' })]) {
      const env = { DB: { prepare: () => ({ first }) } } as unknown as CloudflareBindings;
      expect(await readHomeImageDocument(template, env)).toBe(template);
    }
  });
  it('validates and maps a real public D1 row before selecting the published revision', async () => {
    const row = {
      site_name: 'Published owner', default_language: 'fr', enabled_languages: '["fr","en"]', enabled_services: '["wedding"]',
      contact_email: null, contact_phone: null, contact_address: null, service_area: null,
      map_center_latitude: null, map_center_longitude: null, map_radius_km: null,
      home_galleries_enabled: 0, home_galleries_limit: 6, analytics_measurement_id: null, theme_mode: 'both',
      updated_at: '2026-11-03T00:00:00.000Z', home_hero_image_revision: 12,
      home_hero_image_medium_width: 1024, home_hero_image_large_width: 2048,
    };
    const first = vi.fn().mockResolvedValue(row);
    const env = { DB: { prepare: () => ({ first }) } } as unknown as CloudflareBindings;
    const html = await readHomeImageDocument(template, env);
    expect(first).toHaveBeenCalledOnce();
    expect(html).toContain('/service-media/home-hero/12/medium 1024w');
    expect(html).not.toContain('/home-hero-image/');
    expect(html).toContain('"siteName":"Published owner"');
  });
  it('routes only Home aliases and prevents caching owner snapshots', async () => {
    const server = new Hono<AppEnv>();
    registerHomeDocumentRoutes(server);
    const env = { ASSETS: { fetch: () => Promise.resolve(new Response(template, { headers: { 'Content-Type': 'text/html', ETag: 'old' } })) },
      DB: { prepare: () => ({ first: () => Promise.resolve(null) }) } } as unknown as CloudflareBindings;
    for (const path of ['/', '/fr', '/fr/', '/en', '/en/']) {
      const response = await server.request(`https://example.com${path}`, undefined, env);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-transform');
      expect(response.headers.has('ETag')).toBe(false);
      expect(await response.text()).toContain('Static fallback');
    }
    expect((await server.request('https://example.com/fr/contact/', undefined, env)).status).toBe(404);
  });
});
