import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { registerSearchIndexRoutes } from '../../../src/server/routes/searchIndex';
import type { AppEnv } from '../../../src/server/types';

describe('search index routes', () => {
  const app = new Hono<AppEnv>();
  registerSearchIndexRoutes(app);

  it('serves a site-specific Markdown guide without requiring the gallery database', async () => {
    const response = await app.request('https://example.test/llms.txt', undefined, {
      SITE_NAME: 'Atelier Giulia',
      SITE_DESCRIPTION: 'Portraits et célébrations.',
      SITE_DEFAULT_LANG: 'fr',
    });
    const body = await response.text();
    expect(response.headers.get('Content-Type')).toContain('text/markdown');
    expect(body).toMatch(/^# Atelier Giulia\n/u);
    expect(body).toContain('[Portfolio](https://example.test/fr/portfolio/)');
    expect(body).not.toContain('/galleries');
    expect(body).toContain('[Plan du site](https://example.test/sitemap.xml)');
  });

  it('uses the owner-edited name and description when D1 is available', async () => {
    const row = {
      analytics_measurement_id: null, contact_address: null, contact_email: null, contact_phone: null,
      default_language: 'fr', enabled_languages: '["fr","en"]', enabled_services: '["wedding"]',
      home_galleries_enabled: 1, home_galleries_limit: 6,
      map_center_latitude: null, map_center_longitude: null, map_radius_km: null,
      service_area: null, site_name: 'Studio Boréal',
      site_copy: JSON.stringify({ fr: { description: 'Portraits du Québec.' }, en: { description: 'Portraits from Québec.' } }),
      theme_mode: 'both', updated_at: '2026-09-26T00:00:00.000Z',
    };
    const response = await app.request('https://example.test/llms.txt', undefined, {
      DB: { prepare: () => ({ first: () => Promise.resolve(row) }) },
      SITE_NAME: 'Compiled name', SITE_DESCRIPTION: 'Compiled description', SITE_DEFAULT_LANG: 'fr',
    });
    const body = await response.text();
    expect(body).toMatch(/^# Studio Boréal\n/u);
    expect(body).toContain('> Portraits du Québec.');
  });

  it('serves a text robots file pointing at this hostname', async () => {
    const response = await app.request('https://example.test/robots.txt');
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(await response.text()).toContain('Sitemap: https://example.test/sitemap.xml');
  });

  it('lists portfolio collections without exposing any customer gallery', async () => {
    const prepare = vi.fn(() => ({ all: () => Promise.resolve({ results: [{ slug: 'familles' }] }) }));
    const response = await app.request('https://example.test/sitemap.xml', undefined,
      { DB: { prepare } as unknown as D1Database });
    const body = await response.text();
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(body).toContain('<loc>https://example.test/fr/portfolio/</loc>');
    expect(body).toContain('<loc>https://example.test/en/portfolio/</loc>');
    expect(body).toContain('hreflang="en" href="https://example.test/en/contact/"');
    expect(body).toContain('<loc>https://example.test/fr/portfolio/familles/</loc>');
    expect(body).toContain('<loc>https://example.test/en/portfolio/familles/</loc>');
    expect(body).toContain('hreflang="x-default" href="https://example.test/fr/portfolio/familles/"');
    expect(body).not.toContain('<loc>https://example.test/portfolio/familles</loc>');
    expect(body).toContain('<loc>https://example.test/fr/contact/</loc>');
    expect(body).not.toContain('/e/');
    expect(body).not.toContain('/galleries');
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('FROM portfolio_collections'));
  });

  it('uses the configured public origin when requested through a preview hostname', async () => {
    const response = await app.request('https://preview.example.test/sitemap.xml', undefined, {
      SITE_ORIGIN: 'https://ateliergiulia.com',
      DB: { prepare: () => ({ all: () => Promise.resolve({ results: [] }) }) } as unknown as D1Database,
    });
    const body = await response.text();
    expect(body).toContain('<loc>https://ateliergiulia.com/en/</loc>');
    expect(body).not.toContain('preview.example.test');
  });

  it('omits About from the sitemap when the owner disables that page', async () => {
    const response = await app.request('https://example.test/sitemap.xml', undefined, {
      DB: { prepare: (sql: string) => sql.includes('about_enabled')
        ? { first: () => Promise.resolve({ about_enabled: 0, default_language: 'en' }) }
        : { all: () => Promise.resolve({ results: [] }) } } as unknown as D1Database,
    });
    const body = await response.text();
    expect(body).not.toContain('/about/');
    expect(body).toContain('/contact/');
    expect(body).toContain('hreflang="x-default" href="https://example.test/en/contact/"');
  });
});
