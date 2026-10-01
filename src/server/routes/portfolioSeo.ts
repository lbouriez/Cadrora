import type { Context, Hono } from 'hono';

import { PortfolioCollectionTextSchema } from '../../shared/schemas/portfolio';
import { SlugSchema } from '../../shared/schemas/primitives';
import type { AppEnv } from '../types';

interface PortfolioSeoRow {
  id: string;
  copy_json: string;
  cover_photo_id: string | null;
}

interface SiteSeoRow {
  site_name: string;
  service_area: string | null;
  contact_address: string | null;
  default_language: string;
}

async function siteSeoRow(db: D1Database): Promise<SiteSeoRow | null> {
  try {
    return await db.prepare(`SELECT site_name, service_area, contact_address, default_language
      FROM site_settings WHERE id = 1`).first<SiteSeoRow>();
  } catch {
    return null;
  }
}

function defaultLanguage(row: SiteSeoRow | null, fallback: string): 'fr' | 'en' {
  return (row?.default_language ?? fallback) === 'en' ? 'en' : 'fr';
}

function unavailableDocument(context: Context<AppEnv>, status: 404 | 503) {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.html('<!doctype html><html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>', status);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function collectionDocument(template: string, options: {
  language: 'fr' | 'en'; slug: string; origin: string; defaultLanguage: 'fr' | 'en';
  siteName: string; title: string; description: string; image: string; areaServed: string | null;
}): string {
  const { language, slug, origin, defaultLanguage, siteName } = options;
  const title = escapeHtml(`${options.title} | ${siteName}`);
  const description = escapeHtml(options.description);
  const image = escapeHtml(options.image);
  const localized = (locale: 'fr' | 'en') => `${origin}/${locale}/portfolio/${slug}/`;
  const url = escapeHtml(localized(language));
  const alternates = (['fr', 'en', 'x-default'] as const).map((locale) =>
    `<link rel="alternate" hreflang="${locale}" href="${escapeHtml(localized(locale === 'x-default' ? defaultLanguage : locale))}">`).join('\n');
  const metadata = `<link rel="canonical" href="${url}">
${alternates}
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<script id="site-organization" type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Organization', name: siteName, url: origin,
  image: options.image, ...(options.areaServed ? { areaServed: options.areaServed } : {}),
}).replaceAll('<', '\\u003c')}</script>`;
  const fallback = `<main><h1>${escapeHtml(options.title)}</h1><p>${description}</p><a href="/${language}/portfolio/">Portfolio</a></main>`;
  return template
    .replace(/<title>[^<]*<\/title>/u, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/u, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical"[^>]*>/gu, '')
    .replace(/<link rel="alternate" hreflang="[^"]+"[^>]*>/gu, '')
    .replace(/<meta (?:property="og:(?:title|description|url|image)"|name="twitter:(?:card|title|description|image)") content="[^"]*"\s*\/?\s*>/gu, '')
    .replace(/<script id="site-organization"[^>]*>[\s\S]*?<\/script>/u, '')
    .replace('</head>', `${metadata}</head>`)
    .replace(/<div id="root">[\s\S]*?<\/div>/u, `<div id="root">${fallback}</div>`);
}

/** Collection HTML is the only indexable marketing page whose copy is created after build time. */
export function registerPortfolioSeoRoutes(app: Hono<AppEnv>): void {
  for (const path of ['/services', '/portfolio', '/about', '/contact', '/privacy']) {
    for (const legacy of [path, `${path}/`]) {
      app.get(legacy, async (context) => {
        const language = defaultLanguage(await siteSeoRow(context.env.DB), context.env.SITE_DEFAULT_LANG);
        const query = new URL(context.req.url).search;
        return context.redirect(`/${language}${path}/${query}`, 302);
      });
    }
  }
  for (const legacy of ['/portfolio/:slug', '/portfolio/:slug/']) {
    app.get(legacy, async (context) => {
      const slug = SlugSchema.safeParse(context.req.param('slug'));
      if (!slug.success) return unavailableDocument(context, 404);
      const language = defaultLanguage(await siteSeoRow(context.env.DB), context.env.SITE_DEFAULT_LANG);
      const query = new URL(context.req.url).search;
      return context.redirect(`/${language}/portfolio/${slug.data}/${query}`, 302);
    });
  }
  for (const language of ['fr', 'en'] as const) {
    for (const path of [`/${language}/portfolio/:slug`, `/${language}/portfolio/:slug/`]) {
      app.get(path, async (context) => {
        const slug = SlugSchema.safeParse(context.req.param('slug'));
        if (!slug.success) return unavailableDocument(context, 404);
        const assetUrl = new URL(`/${language}/portfolio/`, context.req.url);
        const asset = await context.env.ASSETS.fetch(new Request(assetUrl));
        if (!asset.ok || !asset.headers.get('Content-Type')?.includes('text/html')) return unavailableDocument(context, 503);
        const template = await asset.text();
        let row: PortfolioSeoRow | null;
        try {
          row = await context.env.DB.prepare(`SELECT id, copy_json, cover_photo_id FROM portfolio_collections
            WHERE slug = ? AND published = 1`).bind(slug.data).first<PortfolioSeoRow>();
        } catch {
          context.header('Cache-Control', 'no-store');
          return context.html(template, 503);
        }
        if (!row) {
          return unavailableDocument(context, 404);
        }
        const copy = PortfolioCollectionTextSchema.parse(JSON.parse(row.copy_json) as unknown)[language];
        const settings = await siteSeoRow(context.env.DB);
        const areaServed = settings?.service_area?.trim() || settings?.contact_address?.trim() || null;
        const description = copy.description || context.env.SITE_DESCRIPTION;
        const summary = `${description}${areaServed ? ` ${language === 'fr' ? 'Région desservie :' : 'Service area:'} ${areaServed}.` : ''}`;
        const origin = context.env.SITE_ORIGIN || new URL(context.req.url).origin;
        const fallbackImage = /<meta property="og:image" content="([^"]+)">/u.exec(template)?.[1]
          ?? `${origin}/home-hero-image/large`;
        let image = fallbackImage;
        try {
          const cover = await context.env.DB.prepare(`SELECT p.id FROM portfolio_photos p
            JOIN portfolio_variants v ON v.photo_id = p.id AND v.variant = 'large'
            WHERE p.collection_id = ? AND p.state = 'published'
            ORDER BY CASE WHEN p.id = ? THEN 0 ELSE 1 END, p.sort_order, p.id LIMIT 1`)
            .bind(row.id, row.cover_photo_id).first<{ id: string }>();
          if (cover) image = `${origin}/portfolio-media/${encodeURIComponent(cover.id)}/large`;
        } catch { /* The published site image remains a valid share fallback. */ }
        context.header('Cache-Control', 'public, max-age=60, no-transform');
        return context.html(collectionDocument(template, {
          language, slug: slug.data, origin, defaultLanguage: defaultLanguage(settings, context.env.SITE_DEFAULT_LANG),
          siteName: settings?.site_name?.trim() || context.env.SITE_NAME, title: copy.title,
          description: summary, image, areaServed,
        }));
      });
    }
  }
}
