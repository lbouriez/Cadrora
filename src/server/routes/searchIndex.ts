import type { Hono } from 'hono';
import { PortfolioSitemapRowsSchema } from '../../shared/schemas/portfolio';

import type { AppEnv } from '../types';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from './siteSettings';
import type { SiteSettingsRow } from './siteSettings';

const publicPages = [
  { path: '/', fr: 'Accueil', en: 'Home' },
  { path: '/services', fr: 'Services', en: 'Services' },
  { path: '/portfolio', fr: 'Portfolio', en: 'Portfolio' },
  { path: '/contact', fr: 'Contact', en: 'Contact' },
  { path: '/privacy', fr: 'Confidentialité', en: 'Privacy' },
] as const;


function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Marketing pages are discoverable; customer galleries are never indexed here. */
export function registerSearchIndexRoutes(app: Hono<AppEnv>): void {
  app.get('/llms.txt', async (context) => {
    const origin = new URL(context.req.url).origin;
    // Keep the compiled profile usable when D1 is unavailable.
    let settings = null;
    try {
      const row = await context.env.DB.prepare(SITE_SETTINGS_SELECT).first<SiteSettingsRow>();
      settings = row ? siteSettingsFromRow(row) : null;
    } catch {
      // Compiled profile remains valid when D1 is unavailable.
    }
    const english = (settings?.defaultLanguage ?? context.env.SITE_DEFAULT_LANG) === 'en';
    const language = english ? 'en' : 'fr';
    const siteName = (settings?.siteName ?? context.env.SITE_NAME).replace(/[\r\n]+/gu, ' ');
    const description = (settings?.siteCopy?.[language].description ?? context.env.SITE_DESCRIPTION).replace(/[\r\n]+/gu, ' ');
    const links = [
      ...publicPages.map((page) => `- [${english ? page.en : page.fr}](${origin}${page.path})`),
      `- [${english ? 'Sitemap' : 'Plan du site'}](${origin}/sitemap.xml)`,
    ].join('\n');
    context.header('Cache-Control', 'public, max-age=3600');
    return context.text(`# ${siteName}\n\n> ${description}\n\n## ${english ? 'Public pages' : 'Pages publiques'}\n\n${links}\n`, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
    });
  });

  app.get('/robots.txt', (context) => {
    const origin = new URL(context.req.url).origin;
    context.header('Cache-Control', 'public, max-age=3600');
    return context.text(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /media/\nSitemap: ${origin}/sitemap.xml\n`, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  });

  app.get('/sitemap.xml', async (context) => {
    const origin = new URL(context.req.url).origin;
    let portfolioPaths: string[] = [];
    try {
      const rows = await context.env.DB.prepare(`SELECT c.slug FROM portfolio_collections c
        WHERE c.published = 1
        ORDER BY c.sort_order, c.id LIMIT 100`).all<unknown>();
      portfolioPaths = PortfolioSitemapRowsSchema.parse(rows.results).map(({ slug }) => `/portfolio/${encodeURIComponent(slug)}`);
    } catch { /* Keep the marketing sitemap available during a D1 outage. */ }
    const paths = [...publicPages.map((page) => page.path), ...portfolioPaths];
    context.header('Cache-Control', 'public, max-age=300');
    return context.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`).join('\n')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  });
}
