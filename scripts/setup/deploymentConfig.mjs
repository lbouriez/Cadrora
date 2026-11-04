import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSiteTarget } from '../instances/instanceConfig.mjs';
import { listSiteProfiles, loadSiteProfile } from '../sites/loadProfile.mjs';

export const workflowFile = 'publish-sites.yml';
export function validateDeployment(config) {
  if (config?.schemaVersion !== 1 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(config.repository ?? '')
    || !/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/u.test(config.instance ?? '')
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(config.profile ?? '')
    || !/^[a-z0-9][a-z0-9-]{0,60}$/u.test(config.environment ?? '')
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(config.hostname ?? '')
    || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/u.test(config.branch ?? '')
    || /\.\.|\/\/|\/$|\.lock(?:\/|$)/u.test(config.branch)) throw new Error('githubConfigInvalid');
  // Canonical order matters for restart-safe JSON fingerprints (PowerShell
  // hashtable property order is not stable across processes).
  return Object.fromEntries(['schemaVersion', 'repository', 'branch', 'profile', 'instance', 'hostname', 'environment'].map((key) => [key, config[key]]));
}

export function readDeployments(root) {
  const directory = join(root, '.cadrora', 'deployments');
  if (!existsSync(directory)) return [];
  const configurations = readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => {
    const config = validateDeployment(JSON.parse(readFileSync(join(directory, name), 'utf8')));
    if (name !== `${config.instance}.json`) throw new Error('githubConfigInvalid');
    return config;
  });
  for (const key of ['instance', 'environment', 'hostname']) {
    if (new Set(configurations.map((item) => item[key])).size !== configurations.length) throw new Error('githubConfigConflict');
  }
  return configurations;
}

export function deploymentMatrix(root, repository, branch, selectedEnvironment = '') {
  return readDeployments(root).filter((item) => item.repository.toLowerCase() === repository.toLowerCase()
    && item.branch === branch && (!selectedEnvironment || item.environment === selectedEnvironment))
    .map(({ environment }) => ({ environment }));
}

export function validateWorkflowEnvironment(root, env) {
  const config = validateDeployment({ schemaVersion: 1, repository: env.GITHUB_REPOSITORY, branch: env.GITHUB_REF_NAME,
    profile: env.CADRORA_SITE, instance: env.CADRORA_INSTANCE, hostname: env.CADRORA_HOSTNAME, environment: env.CADRORA_ENVIRONMENT });
  const saved = readDeployments(root).find((item) => item.environment === config.environment);
  if (saved) {
    for (const key of Object.keys(config)) if (saved[key] !== config[key]) throw new Error('githubConfigConflict');
  } else if (env.CADRORA_LEGACY_TARGET !== 'true') throw new Error('githubConfigInvalid');
  assertSiteTarget(loadSiteProfile(config.profile, root), { instance: config.instance, hostname: config.hostname }, false, listSiteProfiles(root));
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd();
  if (process.argv[2] === 'matrix') {
    const include = deploymentMatrix(root, process.env.GITHUB_REPOSITORY, process.env.GITHUB_REF_NAME, process.env.CADRORA_SELECTED_ENVIRONMENT);
    appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include })}\ncount=${include.length}\n`);
  } else if (process.argv[2] === 'verify') {
    const config = validateWorkflowEnvironment(root, process.env);
    const name = loadSiteProfile(config.profile, root).name;
    if (/[\r\n]/u.test(name)) throw new Error('profileInvalid');
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `VITE_APP_NAME=${name}\n`);
  } else throw new Error('Unknown configuration command.');
}
