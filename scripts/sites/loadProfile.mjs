import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sitePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function loadSiteProfile(siteId, workspace = process.cwd()) {
  if (!sitePattern.test(siteId)) throw new Error(`Invalid CADRORA_SITE: ${siteId}`);
  const path = resolve(workspace, 'sites', siteId, 'profile.json');
  if (!existsSync(path)) throw new Error(`Unknown CADRORA_SITE: ${siteId}`);
  const profile = JSON.parse(readFileSync(path, 'utf8'));
  if (profile.id !== siteId || typeof profile.name !== 'string' || !profile.name) {
    throw new Error(`Invalid site profile: ${siteId}`);
  }
  return profile;
}

export function listSiteProfiles(workspace = process.cwd()) {
  return readdirSync(resolve(workspace, 'sites'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && sitePattern.test(entry.name))
    .filter((entry) => existsSync(resolve(workspace, 'sites', entry.name, 'profile.json')))
    .map((entry) => loadSiteProfile(entry.name, workspace));
}
