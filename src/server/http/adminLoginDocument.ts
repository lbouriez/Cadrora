import copy from '../../shared/i18n/adminMetadata.json';
import { SiteSettingsSchema } from '../../shared/schemas/site';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Called only after the existing admin guard; metadata never grants access. */
export async function adminLoginDocument(template: string, env: CloudflareBindings): Promise<string> {
  let language: 'fr' | 'en' = env.SITE_DEFAULT_LANG === 'en' ? 'en' : 'fr';
  let siteName = env.SITE_NAME || '';
  try {
    const row = await env.DB.prepare('SELECT site_name, default_language FROM site_settings WHERE id = 1')
      .first<{ site_name: unknown; default_language: unknown }>();
    const name = SiteSettingsSchema.shape.siteName.safeParse(row?.site_name);
    const locale = SiteSettingsSchema.shape.defaultLanguage.safeParse(row?.default_language);
    if (name.success) siteName = name.data;
    if (locale.success) language = locale.data;
  } catch { /* A settings outage must not block the login form. */ }
  const title = escapeHtml(`${copy[language].title}${siteName ? ` | ${siteName}` : ''}`);
  const description = escapeHtml(copy[language].description);
  return template
    .replace(/(<html\b[^>]*\blang=")[^"]*/u, `$1${language}`)
    .replace(/<title>[^<]*<\/title>/u, () => `<title>${title}</title>`)
    .replace(/<meta\b[^>]*\b(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/gu, '')
    .replace(/<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*>/gu, '')
    .replace(/<script id="site-organization"[^>]*>[\s\S]*?<\/script>/u, '')
    .replace('</head>', () => `<meta name="description" content="${description}"><meta name="robots" content="noindex,nofollow"></head>`)
    .replace(/<div id="root">[\s\S]*?<\/div>/u,
      () => `<div id="root"><main class="site-startup"><section class="site-startup__identity"><h1>${title}</h1><p>${description}</p></section></main></div>`);
}
