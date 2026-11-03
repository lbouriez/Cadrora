import type { Context } from 'hono';
import startupCopy from '../../shared/i18n/publicStartup.json';
import { SiteSettingsSchema } from '../../shared/schemas/site';
import type { AppEnv } from '../types';
import { optionalRead } from './optionalRead';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** A useful static error, including when optional owner settings or assets fail. */
export async function unavailableDocument(context: Context<AppEnv>, status: 404 | 503): Promise<Response> {
  const [identity, template] = await Promise.all([
    optionalRead(() => context.env.DB.prepare('SELECT site_name, default_language FROM site_settings WHERE id = 1')
      .first<{ site_name: unknown; default_language: unknown }>()),
    optionalRead(async () => {
      const asset = await context.env.ASSETS.fetch(new Request(new URL('/', context.req.url)));
      return asset.ok && asset.headers.get('Content-Type')?.includes('text/html') ? asset.text() : null;
    }),
  ]);
  const name = SiteSettingsSchema.shape.siteName.safeParse(identity?.site_name);
  const locale = SiteSettingsSchema.shape.defaultLanguage.safeParse(identity?.default_language);
  const prefix = /^\/(fr|en)(?:\/|$)/u.exec(new URL(context.req.url).pathname)?.[1];
  const language = (prefix ?? (locale.success ? locale.data : context.env.SITE_DEFAULT_LANG)) === 'en' ? 'en' : 'fr';
  const copy = startupCopy[language];
  const siteName = escapeHtml(name.success ? name.data : context.env.SITE_NAME);
  const title = status === 404 ? copy.notFound : copy.unavailable;
  const lead = status === 404 ? copy.notFoundLead : copy.unavailableLead;
  // Only trusted build-time styling is retained; never execute the application on an error.
  const styles = (template?.match(/<link\b[^>]*>/gu) ?? []).filter(link => /rel="stylesheet"/u.test(link)).join('');
  const profile = template?.match(/\bdata-site="([a-z0-9-]+)"/u)?.[1];
  const action = status === 404 ? `/${language}/portfolio/` : `${new URL(context.req.url).pathname}${new URL(context.req.url).search}`;
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.html(`<!doctype html><html lang="${language}"${profile ? ` data-site="${profile}"` : ''}><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | ${siteName}</title><meta name="robots" content="noindex,nofollow">${styles}</head>
<body><main class="site-startup site-unavailable"><section class="site-startup__identity">
<p class="site-startup__brand">${siteName}</p><p class="site-unavailable__code">${status}</p>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(lead)}</p><nav class="site-unavailable__actions" aria-label="${escapeHtml(copy.navigation)}">
<a class="button button--primary" href="${escapeHtml(action)}">${escapeHtml(status === 404 ? copy.portfolio : copy.retry)}</a>
<a class="button" href="/${language}/">${escapeHtml(copy.home)}</a></nav>
</section></main></body></html>`, status);
}
