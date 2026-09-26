import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { registerSearchIndexRoutes } from '../../../src/server/routes/searchIndex';
import type { AppEnv } from '../../../src/server/types';

describe('search index routes', () => {
  const app = new Hono<AppEnv>();
  registerSearchIndexRoutes(app);

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
