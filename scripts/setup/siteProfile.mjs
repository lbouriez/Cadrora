import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadSiteProfile, listSiteProfiles } from '../sites/loadProfile.mjs';

export const profileIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export function availableProfiles(root) {
  return listSiteProfiles(root).map((profile) => ({
    id: profile.id, name: profile.name,
    example: ['cadrora', 'atelier-giulia', 'studio'].includes(profile.id),
    hostname: profile.deployment?.hostname ?? '',
  }));
}

export function createStudioProfile(root, { id, name, language }) {
  if (!profileIdPattern.test(id) || id.length > 30 || ['studio', 'cadrora', 'atelier-giulia'].includes(id)) throw new Error('profileInvalid');
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || [...name].some((character) => character.codePointAt(0) < 32) || !['fr', 'en'].includes(language)) throw new Error('profileInvalid');
  const destination = resolve(root, 'sites', id);
  if (existsSync(destination)) {
    const existing = loadSiteProfile(id, root);
    if (existing.setupTemplate !== 'studio-v1' || existing.name !== name || existing.defaultLanguage !== language) throw new Error('profileExists');
    return existing; // Resume never overwrites the owner's edits.
  }
  const template = resolve(root, 'sites', 'studio');
  const profile = { ...loadSiteProfile('studio', root), id, name, defaultLanguage: language, setupTemplate: 'studio-v1',
    deployment: { initialSettingsSql: `sites/${id}/initial-settings.sql` } };
  const temporary = resolve(root, 'sites', `.setup-${randomUUID()}`);
  mkdirSync(temporary);
  // Copy only the explicit template files, not secrets or generated artifacts.
  for (const file of ['site.ts', 'theme.css', 'README.md']) {
    const content = readFileSync(join(template, file), 'utf8').replaceAll("data-site='studio'", `data-site='${id}'`);
    writeFileSync(join(temporary, file), content, 'utf8');
  }
  writeFileSync(join(temporary, 'profile.json'), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  const sqlName = name.replaceAll("'", "''");
  const seed = readFileSync(join(template, 'initial-settings.sql'), 'utf8')
    .replace("site_name = 'Studio photo'", `site_name = '${sqlName}'`)
    .replace("default_language = 'fr'", `default_language = '${language}'`);
  writeFileSync(join(temporary, 'initial-settings.sql'), seed, 'utf8');
  renameSync(temporary, destination);
  return loadSiteProfile(id, root);
}

export function profileFiles(root, id) {
  if (!profileIdPattern.test(id)) throw new Error('profileInvalid');
  const base = `sites/${id}`;
  const walk = (directory) => readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw new Error('profileInvalid');
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
  return walk(base);
}
