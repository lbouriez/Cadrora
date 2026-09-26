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
  if (profile.defaultLanguage !== undefined && profile.defaultLanguage !== 'fr' && profile.defaultLanguage !== 'en') {
    throw new Error(`Invalid defaultLanguage for site profile: ${siteId}`);
  }
  return profile;
}

export function profileWorkerVars(profile) {
  return {
    SITE_NAME: profile.name,
    SITE_DESCRIPTION: profile.document.description,
    SITE_DEFAULT_LANG: profile.defaultLanguage ?? 'fr',
  };
}

export function listSiteProfiles(workspace = process.cwd()) {
  return readdirSync(resolve(workspace, 'sites'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && sitePattern.test(entry.name))
    .filter((entry) => existsSync(resolve(workspace, 'sites', entry.name, 'profile.json')))
    .map((entry) => loadSiteProfile(entry.name, workspace));
}
