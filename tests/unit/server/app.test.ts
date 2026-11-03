import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '../../../src/shared/schemas';
import { app } from '../../../src/server/app';

describe('worker app', () => {
  it.each(['fr', 'en'] as const)('isolates login metadata in %s while preserving public indexing and Access protection', async (language) => {
    const template = `<!doctype html><html lang="fr"><head><title>Home</title>
      <meta name="description" content="Home description"><meta name="robots" content="index,follow">
      <link rel="canonical" href="https://example.test/fr/">
      <link rel="alternate" hreflang="en" href="https://example.test/en/">
      <meta property="og:url" content="https://example.test/fr/"><meta name="twitter:image" content="home.webp">
      <script id="site-organization" type="application/ld+json">{}</script>
      <script type="module" src="/assets/app.js"></script></head><body><div id="root"><h1>Home</h1></div></body></html>`;
    const assetFetch = vi.fn(() => Promise.resolve(new Response(template, { headers: { 'Content-Type': 'text/html', ETag: 'home' } })));
    const env = { ADMIN_AUTH_MODE: 'password', SITE_NAME: 'Fallback', SITE_DEFAULT_LANG: 'fr', ASSETS: { fetch: assetFetch },
      DB: { prepare: () => ({ first: () => Promise.resolve({ site_name: 'Studio <été> $&', default_language: language }) }) },
    } as unknown as CloudflareBindings;
    for (const path of ['/admin/login', '/admin/login?demo=1']) {
      const response = await app.request(path, undefined, env);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(response.headers.get('ETag')).toBeNull();
      expect(html).toContain('name="robots" content="noindex,nofollow"');
      expect(html).toContain(`<html lang="${language}">`);
      expect(html).toContain(language === 'fr' ? 'Connexion photographe | Studio &lt;été&gt; $&amp;' : 'Photographer sign in | Studio &lt;été&gt; $&amp;');
      expect(html).not.toMatch(/canonical|hreflang|og:url|twitter:|site-organization|<h1>Home/u);
      expect(html).toContain('/assets/app.js');
    }
    for (const path of ['/fr/', '/en/']) {
      const response = await app.request(path, undefined, env);
      expect(response.headers.get('X-Robots-Tag')).toBeNull();
      expect(await response.text()).toBe(template);
    }
    assetFetch.mockClear();
    const denied = await app.request('/admin/login', undefined, { ...env, ADMIN_AUTH_MODE: 'cloudflare-access' });
    expect(denied.status).toBe(401);
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('keeps login usable with profile metadata when settings are unavailable', async () => {
    const response = await app.request('/admin/login', undefined, {
      ADMIN_AUTH_MODE: 'password', SITE_NAME: 'Studio', SITE_DEFAULT_LANG: 'en',
      DB: { prepare: () => { throw new Error('Unavailable'); } },
      ASSETS: { fetch: () => Promise.resolve(new Response('<html lang="fr"><head><title>Home</title></head></html>', { headers: { 'Content-Type': 'text/html' } })) },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Photographer sign in | Studio</title>');
  });

  it('serves known client documents after the admin guard and preserves unknown status', async () => {
    const assetFetch = vi.fn((request: Request) => Promise.resolve(new Response('<!doctype html><title>Shell</title>', {
      status: new URL(request.url).pathname === '/' ? 200 : 404,
      headers: { 'Content-Type': 'text/html' },
    })));
    const bindings = { ADMIN_AUTH_MODE: 'password', ASSETS: { fetch: assetFetch } } as unknown as CloudflareBindings;
    const denied = await app.request('/admin/settings', undefined, bindings);
    expect(denied.status).toBe(302);
    expect(assetFetch).not.toHaveBeenCalled();
    const login = await app.request('/admin/login', undefined, bindings);
    expect(login.status).toBe(200);
    expect(login.headers.get('Cache-Control')).toBe('no-store');
    const gallery = await app.request('/e/wedding', undefined, bindings);
    expect(gallery.status).toBe(200);
    expect(gallery.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const missing = await app.request('/fr/not-a-route', undefined, bindings);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns a JSON API 404 with a request id and no HTML fallback', async () => {
    const response = await app.request('/api/v1/not-a-route');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.code).toBe('ROUTE_NOT_FOUND');
    expect(body.requestId).not.toBe('');
  });

  it('does not retain the retired events API alias', async () => {
    const response = await app.request('/api/v1/events');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(body.code).toBe('ROUTE_NOT_FOUND');
  });
});
