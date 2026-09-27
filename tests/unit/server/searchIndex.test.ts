import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

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
    expect(body).toContain('[Galeries](https://example.test/galleries)');
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

  it('includes only query-approved public galleries and escapes their slug', async () => {
    const queries: string[] = [];
    const bindings = {
      DB: {
        prepare(query: string) {
          queries.push(query);
          return { all: () => Promise.resolve({ results: [{ slug: 'public & ready' }] }) };
        },
      },
    } as unknown as CloudflareBindings;
    const response = await app.request('https://example.test/sitemap.xml', undefined, bindings);
    const body = await response.text();
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(body).toContain('https://example.test/e/public%20%26%20ready');
    expect(body).toContain('<loc>https://example.test/contact</loc>');
    expect(queries[0]).toContain("access = 'public'");
    expect(queries[0]).toContain('show_on_gallery_page = 1');
    expect(queries[0]).toContain('offline_at IS NULL');
  });
});
