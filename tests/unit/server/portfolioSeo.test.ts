import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { registerPortfolioSeoRoutes } from '../../../src/server/routes/portfolioSeo';
import type { AppEnv } from '../../../src/server/types';

const template = `<!doctype html><html lang="fr"><head>
<title>Portfolio | Cadrora</title><meta
  name="description"
  content="Generic portfolio"
  />
<link rel="canonical" href="https://cadrora.com/fr/portfolio/">
<link rel="alternate" hreflang="fr" href="https://cadrora.com/fr/portfolio/">
<link rel="alternate" hreflang="en" href="https://cadrora.com/en/portfolio/">
<meta property="og:title" content="Portfolio"><meta property="og:description" content="Generic portfolio">
<meta property="og:url" content="https://cadrora.com/fr/portfolio/">
<meta property="og:image" content="https://cadrora.com/home-hero-image/large">
<meta name="twitter:card" content="summary_large_image">
</head><body><div id="root"><main><h1>Portfolio</h1></main></div></body></html>`;

function app() {
  const server = new Hono<AppEnv>();
  registerPortfolioSeoRoutes(server);
  return server;
}

function bindings(published = true) {
  return {
    SITE_DEFAULT_LANG: 'fr', SITE_ORIGIN: 'https://cadrora.com', SITE_NAME: 'Cadrora',
    SITE_DESCRIPTION: 'Cadrora photography',
    ASSETS: { fetch: () => Promise.resolve(new Response(template, { headers: { 'Content-Type': 'text/html' } })) },
    DB: { prepare: (sql: string) => ({
      first: () => Promise.resolve({ site_name: 'Cadrora', service_area: 'Montréal', contact_address: null, default_language: 'fr' }),
      bind: () => ({ first: () => Promise.resolve(sql.includes('FROM portfolio_collections')
      ? published ? { id: 'brands', copy_json: JSON.stringify({
        fr: { title: 'Portraits de marque', description: 'Portraits français.' },
        en: { title: 'Brand portraits', description: 'English portraits.' },
      }), cover_photo_id: 'cover-1' } : null
      : { id: 'cover-1' }) }),
    }) },
  } as unknown as CloudflareBindings;
}

describe('localized portfolio documents', () => {
  it('redirects legacy marketing and collection URLs to the default language', async () => {
    const server = app();
    const collection = await server.request('https://cadrora.com/portfolio/marques?photo=one', undefined, bindings());
    expect(collection.status).toBe(302);
    expect(collection.headers.get('Location')).toBe('/fr/portfolio/marques/?photo=one');
    const contact = await server.request('https://cadrora.com/contact?session=family', undefined, bindings());
    expect(contact.headers.get('Location')).toBe('/fr/contact/?session=family');
  });

  it.each(['/services', '/services/', '/fr/services', '/fr/services/', '/en/services', '/en/services/'])('returns an unindexable 404 for disabled sessions at %s', async (path) => {
    const env = bindings();
    env.DB = { prepare: () => ({ first: () => Promise.resolve({ sessions_page_enabled: 0, default_language: 'fr' }) }) } as unknown as D1Database;
    const response = await app().request(`https://cadrora.com${path}`, undefined, env);
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).not.toContain('Portfolio | Cadrora');
  });

  it('serves static localized sessions when enabled and preserves legacy redirects', async () => {
    const env = bindings();
    env.DB = { prepare: () => ({ first: () => Promise.resolve({ sessions_page_enabled: 1, default_language: 'en' }) }) } as unknown as D1Database;
    const response = await app().request('https://cadrora.com/en/services/', undefined, env);
    expect(response.status).toBe(200);
    const legacy = await app().request('https://cadrora.com/services?session=family', undefined, env);
    expect(legacy.headers.get('Location')).toBe('/en/services/?session=family');
  });

  it('returns 503 rather than exposing sessions when D1 is unavailable', async () => {
    const env = bindings();
    env.DB = { prepare: () => { throw new Error('Unavailable'); } } as unknown as D1Database;
    const response = await app().request('https://cadrora.com/fr/services/', undefined, env);
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('serves bilingual collection metadata, reciprocal alternates, and its cover', async () => {
    const server = app();
    const response = await server.request('https://preview.example.test/en/portfolio/marques/', undefined, bindings());
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<title>Brand portraits | Cadrora</title>');
    expect(html).toContain('<meta name="description" content="English portraits. Service area: Montréal.">');
    expect(html).toContain('<link rel="canonical" href="https://cadrora.com/en/portfolio/marques/">');
    expect(html).toContain('hreflang="fr" href="https://cadrora.com/fr/portfolio/marques/"');
    expect(html).toContain('property="og:image" content="https://cadrora.com/portfolio-media/cover-1/large"');
    expect(html).toContain('<h1>Brand portraits</h1>');
    expect(html).toContain('<main class="site-startup">');
    expect(html).toContain('<details class="site-startup__fallback">');
    expect(html).toContain('<summary>Browse pages</summary>');
    expect(html).toContain('"areaServed":"Montréal"');
    expect(html).not.toContain('rel="canonical" href="https://cadrora.com/fr/portfolio/"');
  });

  it('does not index an unpublished collection', async () => {
    const response = await app().request('https://cadrora.com/fr/portfolio/marques/', undefined, bindings(false));
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns a retryable page when collection metadata cannot be read', async () => {
    const env = bindings();
    env.DB = { prepare: () => { throw new Error('D1 unavailable'); } } as unknown as D1Database;
    const response = await app().request('https://cadrora.com/en/portfolio/marques/', undefined, env);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
