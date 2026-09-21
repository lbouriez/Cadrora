import { createHmac, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const passwordBytes = 32;
const pepperBytes = 32;
const saltBytes = 32;
const defaultOutput = '.artifacts/setup/admin-credentials.env';
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf('--output');
const outputArgument = outputIndex >= 0 ? argumentsList[outputIndex + 1] : undefined;
const force = argumentsList.includes('--force');
const migrate = argumentsList.includes('--migrate');

function parseEnvironment(content) {
  const values = new Map();
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return values;
}

function isAuthPepper(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= pepperBytes;
}

function createAdminHash(password, pepper) {
  const salt = randomBytes(saltBytes).toString('base64url');
  const mac = createHmac('sha256', `cadrora-password-admin-v1:${pepper}`)
    .update(`${salt}:${password}`, 'utf8')
    .digest('base64url');
  return `hmac-sha256$${salt}$${mac}`;
}

if (argumentsList.includes('--help')) {
  process.stdout.write(`Usage: npm run setup:admin-credentials [-- --output <.artifacts/private-path> --force | --migrate]\n\n`);
  process.stdout.write('Creates a 256-bit admin password, a stable AUTH_PEPPER, and the required HMAC hash in an ignored private file.\n');
  process.stdout.write('Use --migrate on an existing artifact to preserve ADMIN_PASSWORD while adding AUTH_PEPPER and recalculating ADMIN_SECRET_HASH.\n');
  process.exit(0);
}

if ((outputIndex >= 0 && !outputArgument)
  || (force && migrate)
  || argumentsList.some((argument, index) => argument !== '--force'
    && argument !== '--migrate'
    && argument !== '--output'
    && index !== outputIndex + 1)) {
  process.stderr.write('Use --help for supported credential-generation options.\n');
  process.exit(2);
}

const workspace = resolve(process.cwd());
const output = resolve(workspace, outputArgument ?? defaultOutput);
const artifactsDirectory = resolve(workspace, '.artifacts');
const artifactRelativePath = relative(artifactsDirectory, output);
if (artifactRelativePath.startsWith('..') || artifactRelativePath === '') {
  process.stderr.write('Credential output must stay below the ignored .artifacts directory.\n');
  process.exit(2);
}

let password;
let pepper;
if (migrate) {
  if (!existsSync(output)) {
    process.stderr.write(`Cannot migrate missing private credentials at ${output}. Generate new credentials instead.\n`);
    process.exit(1);
  }
  const existing = parseEnvironment(await readFile(output, 'utf8'));
  password = existing.get('ADMIN_PASSWORD');
  if (!password) {
    process.stderr.write('Cannot migrate: the private artifact has no ADMIN_PASSWORD. Create new credentials only after recording the current password.\n');
    process.exit(1);
  }
  const existingPepper = existing.get('AUTH_PEPPER');
  pepper = isAuthPepper(existingPepper) ? existingPepper : randomBytes(pepperBytes).toString('base64url');
} else {
  if (existsSync(output) && !force) {
    process.stderr.write(`Refusing to overwrite existing private credentials at ${output}. Use --migrate to retain its password, or --force only after recording it.\n`);
    process.exit(1);
  }
  password = randomBytes(passwordBytes).toString('base64url');
  pepper = randomBytes(pepperBytes).toString('base64url');
}

const passwordHash = createAdminHash(password, pepper);
const outputContent = [
  '# Generated locally by scripts/setup/adminCredentials.mjs.',
  '# Keep this file private; it is ignored by Git. Store ADMIN_PASSWORD in a password manager.',
  `ADMIN_PASSWORD=${password}`,
  `AUTH_PEPPER=${pepper}`,
  `ADMIN_SECRET_HASH=${passwordHash}`,
  '',
].join('\n');

await mkdir(dirname(output), { recursive: true });
await writeFile(output, outputContent, { encoding: 'utf8', mode: 0o600 });
try {
  await chmod(output, 0o600);
} catch {
  // Windows may not support POSIX modes. The ignored workspace path still prevents source control exposure.
}

process.stdout.write(`Private admin credentials written to ${output}. Values were not printed.\n`);
process.stdout.write(migrate
  ? 'Existing ADMIN_PASSWORD was preserved; set both AUTH_PEPPER and ADMIN_SECRET_HASH as encrypted Worker secrets.\n'
  : 'Store the password before using AUTH_PEPPER and ADMIN_SECRET_HASH as Worker secrets.\n');
