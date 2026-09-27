import type { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../types';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from './siteSettings';
import type { SiteSettingsRow } from './siteSettings';

const SitemapGalleryRow = z.object({ slug: z.string().min(1) });

const publicPages = [
  { path: '/', fr: 'Accueil', en: 'Home' },
  { path: '/services', fr: 'Services', en: 'Services' },
  { path: '/galleries', fr: 'Galeries', en: 'Galleries' },
  { path: '/contact', fr: 'Contact', en: 'Contact' },
  { path: '/privacy', fr: 'Confidentialité', en: 'Privacy' },
] as const;

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Only public, listed, online galleries are discoverable. */
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
    const rows = await context.env.DB.prepare(
      `SELECT slug FROM events WHERE visibility = 'published' AND access = 'public'
       AND show_on_gallery_page = 1 AND offline_at IS NULL AND deleting_at IS NULL
       ORDER BY created_at DESC, id ASC`,
    ).all<unknown>();
    const galleries = z.array(SitemapGalleryRow).parse(rows.results);
    const origin = new URL(context.req.url).origin;
    const paths = [...publicPages.map((page) => page.path), ...galleries.map(({ slug }) => `/e/${encodeURIComponent(slug)}`)];
    context.header('Cache-Control', 'public, max-age=300');
    return context.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`).join('\n')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  });
}
