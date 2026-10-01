import type { Hono } from 'hono';
import { PortfolioSitemapRowsSchema } from '../../shared/schemas/portfolio';

import type { AppEnv } from '../types';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from './siteSettings';
import type { SiteSettingsRow } from './siteSettings';

const publicPages = [
  { path: '/', fr: 'Accueil', en: 'Home' },
  { path: '/services', fr: 'Services', en: 'Services' },
  { path: '/portfolio', fr: 'Portfolio', en: 'Portfolio' },
  { path: '/about', fr: 'À propos', en: 'About' },
  { path: '/contact', fr: 'Contact', en: 'Contact' },
  { path: '/privacy', fr: 'Confidentialité', en: 'Privacy' },
] as const;


function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Marketing pages are discoverable; customer galleries are never indexed here. */
export function registerSearchIndexRoutes(app: Hono<AppEnv>): void {
  app.get('/llms.txt', async (context) => {
    const origin = context.env?.SITE_ORIGIN || new URL(context.req.url).origin;
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
      ...publicPages.filter((page) => (page.path !== '/about' || settings?.aboutEnabled === true)
        && (page.path !== '/services' || settings?.sessionsPageEnabled === true))
        .map((page) => `- [${english ? page.en : page.fr}](${origin}/${language}${page.path === '/' ? '/' : `${page.path}/`})`),
      `- [${english ? 'Sitemap' : 'Plan du site'}](${origin}/sitemap.xml)`,
    ].join('\n');
    context.header('Cache-Control', 'no-store');
    return context.text(`# ${siteName}\n\n> ${description}\n\n## ${english ? 'Public pages' : 'Pages publiques'}\n\n${links}\n`, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
    });
  });

  app.get('/robots.txt', (context) => {
    const origin = context.env?.SITE_ORIGIN || new URL(context.req.url).origin;
    context.header('Cache-Control', 'public, max-age=3600');
    return context.text(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /media/\nSitemap: ${origin}/sitemap.xml\n`, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  });

  app.get('/sitemap.xml', async (context) => {
    const origin = context.env?.SITE_ORIGIN || new URL(context.req.url).origin;
    let portfolioPaths: string[] = [];
    let aboutEnabled = false;
    let sessionsPageEnabled = false;
    let defaultLanguage: 'fr' | 'en' = context.env.SITE_DEFAULT_LANG === 'en' ? 'en' : 'fr';
    try {
      const rows = await context.env.DB.prepare(`SELECT c.slug FROM portfolio_collections c
        WHERE c.published = 1
        ORDER BY c.sort_order, c.id LIMIT 100`).all<unknown>();
      portfolioPaths = PortfolioSitemapRowsSchema.parse(rows.results).map(({ slug }) => `/portfolio/${encodeURIComponent(slug)}`);
    } catch { /* Keep the marketing sitemap available during a D1 outage. */ }
    try {
      const row = await context.env.DB.prepare('SELECT about_enabled, sessions_page_enabled, default_language FROM site_settings WHERE id = 1')
        .first<{ about_enabled: number; sessions_page_enabled: number; default_language: string }>();
      aboutEnabled = row?.about_enabled === 1;
      sessionsPageEnabled = row?.sessions_page_enabled === 1;
      if (row?.default_language === 'fr' || row?.default_language === 'en') defaultLanguage = row.default_language;
    } catch { /* Keep optional pages hidden while their availability is unknown. */ }
    context.header('Cache-Control', 'no-store');
    const paths = [
      ...publicPages.filter((page) => (page.path !== '/about' || aboutEnabled)
        && (page.path !== '/services' || sessionsPageEnabled)).map((page) => page.path),
      ...portfolioPaths,
    ];
    const marketingUrls = paths.flatMap((path) => (['fr', 'en'] as const).map((language) => {
      const localized = (lang: 'fr' | 'en') => `${origin}/${lang}${path === '/' ? '/' : `${path}/`}`;
      const alternates = (['fr', 'en', 'x-default'] as const).map((lang) =>
        `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(localized(lang === 'x-default'
          ? defaultLanguage : lang))}"/>`).join('');
      return `  <url><loc>${escapeXml(localized(language))}</loc>${alternates}</url>`;
    }));
    return context.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${marketingUrls.join('\n')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  });
}
