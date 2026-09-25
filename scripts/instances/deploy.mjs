import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertManifestTarget,
  assertSiteTarget,
  instanceResourceNames,
  instanceUsage,
  instanceWranglerConfig,
  parseInstanceArguments,
  parseR2BucketNames,
} from './instanceConfig.mjs';
import { listSiteProfiles, loadSiteProfile } from '../sites/loadProfile.mjs';

const wranglerPath = 'node_modules/wrangler/bin/wrangler.js';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(scriptDirectory, '..', '..');

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    cwd: workspace,
    encoding: options.capture ? 'utf8' : undefined,
    env: { ...process.env, CI: 'true', NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false' },
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = options.capture ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() : '';
    throw new Error(`${options.label ?? command} failed with status ${String(result.status ?? 1)}${details ? `:\n${details}` : '.'}`);
  }
  return options.capture ? String(result.stdout ?? '') : '';
}

function wrangler(argumentsList, options = {}) {
  if (!existsSync(resolve(workspace, wranglerPath))) throw new Error('Wrangler is not installed. Run npm ci first.');
  return run(process.execPath, [wranglerPath, ...argumentsList], { ...options, label: options.label ?? 'Wrangler' });
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function parseEnvironment(content) {
  const values = new Map();
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return values;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Configure it before provisioning an instance.`);
  return value;
}

async function ensureCredentials(instanceDirectory) {
  const environmentHash = process.env.ADMIN_SECRET_HASH?.trim();
  const environmentPepper = process.env.AUTH_PEPPER?.trim();
  if (environmentHash || environmentPepper) {
    if (!environmentHash || !environmentPepper) throw new Error('ADMIN_SECRET_HASH and AUTH_PEPPER must be supplied together.');
    if (!/^hmac-sha256\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/u.test(environmentHash)
      || Buffer.byteLength(environmentPepper, 'utf8') < 32) {
      throw new Error('Deployment credentials have an invalid format. Regenerate them outside CI without printing their values.');
    }
    return { adminHash: environmentHash, authPepper: environmentPepper, credentialsPath: null };
  }
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('CI deployments require stable ADMIN_SECRET_HASH and AUTH_PEPPER secrets.');
  }
  const credentialsPath = join(instanceDirectory, 'admin-credentials.env');
  if (!existsSync(credentialsPath)) {
    run(process.execPath, ['scripts/setup/adminCredentials.mjs', '--output', credentialsPath]);
  }
  const values = parseEnvironment(await readFile(credentialsPath, 'utf8'));
  const authPepper = values.get('AUTH_PEPPER');
  const adminHash = values.get('ADMIN_SECRET_HASH');
  if (!authPepper || !adminHash || !values.get('ADMIN_PASSWORD')) {
    throw new Error(`Private credentials are incomplete at ${credentialsPath}.`);
  }
  return { adminHash, authPepper, credentialsPath };
}

async function ensureResources(names) {
  const databaseList = parseJson(wrangler(['d1', 'list', '--json'], {
    capture: true,
    label: 'D1 discovery (use a Cloudflare API token with D1 Write if OAuth cannot list databases)',
  }), 'D1 discovery');
  let database = databaseList.find((candidate) => candidate.name === names.database);
  if (!database) {
    const location = process.env.CADRORA_D1_LOCATION?.trim();
    wrangler(['d1', 'create', names.database, ...(location ? ['--location', location] : [])]);
    const refreshed = parseJson(wrangler(['d1', 'list', '--json'], { capture: true }), 'D1 discovery');
    database = refreshed.find((candidate) => candidate.name === names.database);
  }
  if (!database?.uuid) throw new Error(`D1 ${names.database} was not found after provisioning.`);

  const buckets = parseR2BucketNames(wrangler(['r2', 'bucket', 'list'], { capture: true }));
  for (const bucket of [names.mediaBucket, names.modelsBucket]) {
    if (!buckets.has(bucket)) wrangler(['r2', 'bucket', 'create', bucket]);
  }

  const indexes = parseJson(wrangler(['vectorize', 'list', '--json'], { capture: true }), 'Vectorize discovery');
  if (!indexes.some((candidate) => candidate.name === names.faceIndex)) {
    wrangler([
      'vectorize', 'create', names.faceIndex,
      '--dimensions', '128', '--metric', 'cosine',
      '--description', `Cadrora ${names.worker} gallery-scoped face index`,
    ]);
  }
  const metadataIndexes = parseJson(
    wrangler(['vectorize', 'list-metadata-index', names.faceIndex, '--json'], { capture: true }),
    'Vectorize metadata discovery',
  );
  if (!metadataIndexes.some((candidate) => candidate.propertyName === 'partition_id')) {
    wrangler([
      'vectorize', 'create-metadata-index', names.faceIndex,
      '--propertyName', 'partition_id', '--type', 'string',
    ]);
  }
  return { databaseId: database.uuid };
}

async function syncModels(bucketName, configPath) {
  run(process.execPath, ['scripts/models/download.mjs']);
  for (const filename of ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx']) {
    wrangler([
      'r2', 'object', 'put', `${bucketName}/models/v1/${filename}`,
      '--file', join('.artifacts/models', filename),
      '--content-type', 'application/octet-stream', '--force', '--remote',
      '--config', configPath, '--env=',
    ]);
  }
}

const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  process.stdout.write(instanceUsage());
  process.stdout.write('Creates or reuses isolated Cloudflare resources, deploys Cadrora, and attaches the exact hostname.\n');
  process.exit(0);
}

try {
  const target = parseInstanceArguments(argumentsList);
  const siteId = process.env.CADRORA_SITE?.trim() || 'cadrora';
  const site = loadSiteProfile(siteId, workspace);
  assertSiteTarget(site, target, process.env.CADRORA_SEED_DEMO?.trim().toLowerCase() === 'true', listSiteProfiles(workspace));
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    requiredEnvironment('CLOUDFLARE_ACCOUNT_ID');
    requiredEnvironment('CLOUDFLARE_API_TOKEN');
  }
  requiredEnvironment('VITE_TURNSTILE_SITE_KEY');
  const turnstileSecret = requiredEnvironment('TURNSTILE_SECRET_KEY');
  const names = instanceResourceNames(target.instance);
  const instanceDirectory = resolve(workspace, '.artifacts', 'instances', target.instance);
  await mkdir(instanceDirectory, { recursive: true });
  const manifestPath = join(instanceDirectory, 'manifest.json');
  if (existsSync(manifestPath)) {
    assertManifestTarget(
      parseJson(await readFile(manifestPath, 'utf8'), `Instance manifest ${manifestPath}`),
      target,
    );
  }
  const credentials = await ensureCredentials(instanceDirectory);

  process.stdout.write(`Provisioning isolated instance ${target.instance} for ${target.hostname}.\n`);
  const resources = await ensureResources(names);
  const baseConfig = JSON.parse(await readFile(resolve(workspace, 'wrangler.jsonc'), 'utf8'));
  const config = instanceWranglerConfig(baseConfig, names, resources.databaseId, target.hostname);
  const configPath = join(instanceDirectory, 'wrangler.json');
  const secretsPath = join(instanceDirectory, 'deploy-secrets.env');
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(
    secretsPath,
    `ADMIN_SECRET_HASH=${JSON.stringify(credentials.adminHash)}\nAUTH_PEPPER=${JSON.stringify(credentials.authPepper)}\nTURNSTILE_SECRET_KEY=${JSON.stringify(turnstileSecret)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  try { await chmod(secretsPath, 0o600); } catch { /* Windows uses the ignored private directory boundary. */ }

  try {
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
    wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath, '--env=']);
    if (site.deployment?.initialSettingsSql) {
      wrangler(['d1', 'execute', 'DB', '--remote', '--file', site.deployment.initialSettingsSql, '--config', configPath, '--env=']);
    }
    await syncModels(names.modelsBucket, configPath);
    wrangler(['deploy', '--config', configPath, '--secrets-file', secretsPath, '--env=']);
  } finally {
    await rm(secretsPath, { force: true });
  }

  await writeFile(manifestPath, `${JSON.stringify({
    createdBy: 'scripts/instances/deploy.mjs',
    databaseId: resources.databaseId,
    deployedAt: new Date().toISOString(),
    hostname: target.hostname,
    instance: target.instance,
    resources: names,
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Instance deployed: https://${target.hostname}\n`);
  if (credentials.credentialsPath) process.stdout.write(`Private admin credentials: ${credentials.credentialsPath}\n`);
  else process.stdout.write('Private admin credentials came from deployment secrets.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Instance deployment failed.'}\n`);
  process.exit(2);
}
