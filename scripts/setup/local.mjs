import { createHmac, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const testTurnstileSiteKey = '1x00000000000000000000AA';
const testTurnstileSecretKey = '1x0000000000000000000000000000000AA';
const targets = [
  '.artifacts/setup/admin-credentials.env',
  '.dev.vars',
  '.env',
];

if (process.argv.slice(2).includes('--help')) {
  process.stdout.write('Usage: npm run setup:local\n\n');
  process.stdout.write('Creates ignored local credentials, installs Cloudflare test-only Turnstile keys, and applies local D1 migrations.\n');
  process.exit(0);
}

if (process.argv.length > 2) {
  process.stderr.write('setup:local accepts no options. Use --help for details.\n');
  process.exit(2);
}

const existingTargets = targets.filter((path) => existsSync(path));
if (existingTargets.length > 0) {
  process.stderr.write(`Refusing to overwrite existing local setup file(s): ${existingTargets.join(', ')}.\n`);
  process.stderr.write('Keep the existing values and run npm run setup, or remove only the files you intentionally want to replace.\n');
  process.exit(1);
}

const password = randomBytes(32).toString('base64url');
const authPepper = randomBytes(32).toString('base64url');
const salt = randomBytes(32).toString('base64url');
const mac = createHmac('sha256', `cadrora-password-admin-v1:${authPepper}`)
  .update(`${salt}:${password}`, 'utf8')
  .digest('base64url');
const passwordHash = `hmac-sha256$${salt}$${mac}`;

const files = new Map([
  ['.artifacts/setup/admin-credentials.env', [
    '# Generated locally by scripts/setup/local.mjs.',
    '# Keep this file private; it is ignored by Git. Store ADMIN_PASSWORD in a password manager.',
    `ADMIN_PASSWORD=${password}`,
    `AUTH_PEPPER=${authPepper}`,
    `ADMIN_SECRET_HASH=${passwordHash}`,
    '',
  ].join('\n')],
  ['.dev.vars', [
    '# Local development only. Never deploy these Cloudflare test credentials to production.',
    `ADMIN_SECRET_HASH=${passwordHash}`,
    `AUTH_PEPPER=${authPepper}`,
    `TURNSTILE_SECRET_KEY=${testTurnstileSecretKey}`,
    '',
  ].join('\n')],
  ['.env', [
    '# Local public configuration. The Turnstile site key below is an official test-only key.',
    'VITE_APP_NAME=Cadrora',
    'VITE_SITE_DEFAULT_LANG=fr',
    'VITE_PHOTOGRAPHER_NAME=',
    'VITE_CONTACT_PHONE=',
    'VITE_CONTACT_EMAIL=',
    'VITE_CONTACT_ADDRESS=',
    'VITE_SERVICE_AREA=',
    `VITE_TURNSTILE_SITE_KEY=${testTurnstileSiteKey}`,
    '',
  ].join('\n')],
]);

for (const [path, content] of files) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try {
    await chmod(absolutePath, 0o600);
  } catch {
    // Windows may not support POSIX modes. All generated paths are ignored by Git.
  }
}

process.stdout.write('Ignored local credentials and Cloudflare test-only Turnstile keys were created without printing their values.\n');
process.stdout.write('Private admin credentials are in .artifacts/setup/admin-credentials.env.\n');

const setup = spawnSync(process.execPath, ['scripts/setup/index.mjs'], {
  encoding: 'utf8',
  stdio: 'inherit',
});
process.exit(setup.status ?? 1);
