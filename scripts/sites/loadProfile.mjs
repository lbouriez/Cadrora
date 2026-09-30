import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sitePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function loadSiteProfile(siteId, workspace = process.cwd()) {
  if (!sitePattern.test(siteId)) throw new Error(`Invalid CADRORA_SITE: ${siteId}`);
  const path = resolve(workspace, 'sites', siteId, 'profile.json');
  if (!existsSync(path)) throw new Error(`Unknown CADRORA_SITE: ${siteId}`);
  const profile = JSON.parse(readFileSync(path, 'utf8'));
  if (profile.id !== siteId || typeof profile.name !== 'string' || !profile.name ||
      typeof profile.document?.description !== 'string' || !profile.document.description) {
    throw new Error(`Invalid site profile: ${siteId}`);
  }
  if (typeof profile.heroImageUrl !== 'string' || !/^\/brand\/[a-z0-9-]+\.webp$/u.test(profile.heroImageUrl)) {
    throw new Error(`Invalid heroImageUrl for site profile: ${siteId}`);
  }
  if (profile.defaultLanguage !== undefined && profile.defaultLanguage !== 'fr' && profile.defaultLanguage !== 'en') {
    throw new Error(`Invalid defaultLanguage for site profile: ${siteId}`);
  }
  if (profile.document.fonts !== undefined && (!Array.isArray(profile.document.fonts)
      || profile.document.fonts.some((font) => typeof font !== 'string'
        || !new RegExp(`^/sites/${siteId}/fonts/[a-zA-Z0-9-]+\\.woff2$`, 'u').test(font)
        || !existsSync(resolve(workspace, font.slice(1)))))) {
    throw new Error(`Invalid document fonts for site profile: ${siteId}`);
  }
  if (profile.document.origin !== undefined) {
    const origin = new URL(profile.document.origin);
    if (origin.protocol !== 'https:' || origin.origin !== profile.document.origin
      || typeof profile.document.shareImage !== 'string'
      || !/^\/(?:brand\/[a-z0-9-]+\.(?:png|jpg|webp)|home-hero-image\/large)$/u.test(profile.document.shareImage)) {
      throw new Error(`Invalid SEO origin or share image for site profile: ${siteId}`);
    }
    const pages = ['home', 'services', 'portfolio', 'about', 'contact', 'privacy'];
    if (pages.some((page) => ['fr', 'en'].some((language) => {
      const copy = profile.document.pages?.[page]?.[language];
      return typeof copy?.title !== 'string' || !copy.title.trim()
        || typeof copy?.description !== 'string' || !copy.description.trim();
    }))) throw new Error(`Missing bilingual SEO copy for site profile: ${siteId}`);
    if (profile.document.locales !== undefined && ['fr', 'en'].some((language) =>
      !new RegExp(`^${language}_[A-Z]{2}$`, 'u').test(profile.document.locales[language] ?? ''))) {
      throw new Error(`Invalid social locale for site profile: ${siteId}`);
    }
  }
  return profile;
}

export function profileWorkerVars(profile) {
  return {
    SITE_NAME: profile.name,
    SITE_DESCRIPTION: profile.document.description,
    SITE_HERO_IMAGE_URL: profile.heroImageUrl,
    SITE_DEFAULT_LANG: profile.defaultLanguage ?? 'fr',
    SITE_ORIGIN: profile.document.origin ?? '',
  };
}

export function listSiteProfiles(workspace = process.cwd()) {
  return readdirSync(resolve(workspace, 'sites'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && sitePattern.test(entry.name))
    .filter((entry) => existsSync(resolve(workspace, 'sites', entry.name, 'profile.json')))
    .map((entry) => loadSiteProfile(entry.name, workspace));
}
