import { HOME_HERO_RESPONSIVE_SIZES, homeHeroSources } from '../../shared/homeHeroPhoto';
import { SiteSettingsSchema } from '../../shared/schemas/site';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from '../routes/siteSettings';
import type { SiteSettingsRow } from '../routes/siteSettings';
import { optionalRead } from './optionalRead';

export const HOME_IMAGE_MARKER = '<meta name="cadrora-home-image" content="full-width">';

/** Only validated PUBLIC settings enter this non-executable snapshot. No secrets/bindings. */
export function homeImageDocument(template: string, value: unknown): string {
  const parsed = SiteSettingsSchema.safeParse(value);
  if (!template.includes(HOME_IMAGE_MARKER) || !parsed.success) return template;
  const settings = parsed.data;
  // A published owner revision with unknown dimensions is uncertain: do not hint a default.
  if (settings.homeHeroImageRevision && (!settings.homeHeroImageMediumWidth || !settings.homeHeroImageLargeWidth)) return template;
  const sources = homeHeroSources(settings).sort((a, b) => a.width - b.width);
  const hint = `<link data-home-photo-preload rel="preload" as="image" fetchpriority="high" imagesrcset="${sources.map(s => `${s.url} ${s.width}w`).join(', ')}" imagesizes="${HOME_HERO_RESPONSIVE_SIZES}">`;
  const snapshot = JSON.stringify(settings).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  // The browser consumes this snapshot through the same SiteSettingsSchema as /api/v1/site.
  // Sharing one read prevents an older cached API response choosing a different image.
  return template.replace('</head>', () => `${hint}<script id="cadrora-initial-site" type="application/json">${snapshot}</script></head>`);
}

export async function readHomeImageDocument(template: string, env: CloudflareBindings): Promise<string> {
  if (!template.includes(HOME_IMAGE_MARKER)) return template;
  const settings = await optionalRead(async () => {
    const row = await env.DB.prepare(SITE_SETTINGS_SELECT).first<SiteSettingsRow>();
    return row ? siteSettingsFromRow(row) : null;
  });
  return settings ? homeImageDocument(template, settings) : template;
}
