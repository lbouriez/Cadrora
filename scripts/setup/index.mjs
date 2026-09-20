import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const argumentsSet = new Set(process.argv.slice(2));
const allowedArguments = new Set(['--diagnose', '--help']);
const unknownArguments = [...argumentsSet].filter((argument) => !allowedArguments.has(argument));
const diagnoseOnly = argumentsSet.has('--diagnose');
const minimumNodeMajor = 22;

if (argumentsSet.has('--help')) {
  process.stdout.write(`Usage: npm run setup [-- --diagnose]\n\n`);
  process.stdout.write(`Default mode verifies local prerequisites and applies local D1 migrations.\n`);
  process.stdout.write(`--diagnose never writes files or calls Cloudflare.\n`);
  process.exit(0);
}

if (unknownArguments.length > 0) {
  process.stderr.write(`Unknown setup option(s): ${unknownArguments.join(', ')}\n`);
  process.exit(2);
}

function report(status, subject, detail) {
  process.stdout.write(`[${status}] ${subject}: ${detail}\n`);
}

function fail(subject, detail) {
  report('error', subject, detail);
  process.exitCode = 1;
}

function hasBinding(configText, binding) {
  return new RegExp(`"binding"\\s*:\\s*"${binding}"`).test(configText);
}

function parseDotenvKeys(content) {
  const values = new Map();
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function hasPasswordHashFormat(value) {
  const [algorithm, iterationsText, salt, derivedKey, extra] = value.split('$');
  const iterations = Number(iterationsText);
  return algorithm === 'pbkdf2-sha256'
    && extra === undefined
    && Number.isSafeInteger(iterations)
    && iterations >= 600_000
    && iterations <= 2_000_000
    && /^[A-Za-z0-9_-]{22,}$/u.test(salt ?? '')
    && /^[A-Za-z0-9_-]{43}$/u.test(derivedKey ?? '');
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < minimumNodeMajor) {
  fail('Node.js', `version ${minimumNodeMajor}+ required; found ${process.versions.node}`);
} else {
  report('ok', 'Node.js', process.versions.node);
}

for (const path of ['package.json', 'wrangler.jsonc']) {
  if (existsSync(path)) report('ok', path, 'present');
  else fail(path, 'missing');
}

const migrationFiles = existsSync('migrations')
  ? (await readdir('migrations')).filter((path) => /^\d+_.+\.sql$/u.test(path))
  : [];
if (migrationFiles.length === 0) fail('migrations', 'no ordered .sql migrations found');
else report('ok', 'migrations', `${migrationFiles.length} ordered migration file(s) found`);

if (!existsSync('node_modules/wrangler/bin/wrangler.js')) {
  fail('dependencies', 'missing; run npm ci first');
} else {
  report('ok', 'dependencies', 'Wrangler is installed');
}

let wranglerConfig = '';
try {
  wranglerConfig = await readFile('wrangler.jsonc', 'utf8');
} catch {
  // The missing-file diagnostic above is clearer than a second filesystem error.
}
for (const binding of ['DB', 'MEDIA_BUCKET', 'MODELS_BUCKET']) {
  if (hasBinding(wranglerConfig, binding)) report('ok', `${binding} binding`, 'declared in wrangler.jsonc');
  else fail(`${binding} binding`, 'required; restore the binding before local or remote operation');
}

const devVarsPath = existsSync('.dev.vars') ? '.dev.vars' : existsSync('.env') ? '.env' : undefined;
if (!devVarsPath) {
  fail('local secrets', 'missing .dev.vars or .env; the Worker will fail closed before admin or unlock work');
} else {
  const values = parseDotenvKeys(await readFile(devVarsPath, 'utf8'));
  const passwordHash = values.get('ADMIN_SECRET_HASH') ?? '';
  const turnstileSecret = values.get('TURNSTILE_SECRET_KEY') ?? '';
  if (hasPasswordHashFormat(passwordHash)) report('ok', 'ADMIN_SECRET_HASH', 'present with accepted PBKDF2 format');
  else fail('ADMIN_SECRET_HASH', 'missing or invalid; generate private credentials with npm run setup:admin-credentials');
  if (turnstileSecret.length > 0) report('ok', 'TURNSTILE_SECRET_KEY', 'present (value not inspected or printed)');
  else fail('TURNSTILE_SECRET_KEY', 'missing; the Worker intentionally rejects login and event-unlock requests without it');
}

if (diagnoseOnly || process.exitCode) {
  report('info', 'mode', diagnoseOnly ? 'diagnostic only; no files or Cloudflare resources changed' : 'stopped before local migration');
  process.exit(process.exitCode ?? 0);
}

const localStateExisted = existsSync('.wrangler/state/v3/d1');
const migration = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local'],
  { encoding: 'utf8', stdio: 'pipe' },
);

if (migration.status !== 0) {
  if (migration.stdout) process.stdout.write(migration.stdout);
  if (migration.stderr) process.stderr.write(migration.stderr);
  fail('local D1', 'migration failed');
} else {
  report(localStateExisted ? 'reused' : 'created', 'local D1', 'schema is current; existing data was preserved');
}
