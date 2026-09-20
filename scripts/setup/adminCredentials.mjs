import { pbkdf2, randomBytes } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const deriveKey = promisify(pbkdf2);
const iterations = 600_000;
const saltBytes = 16;
const derivedKeyBytes = 32;
const passwordBytes = 32;
const defaultOutput = '.artifacts/setup/admin-credentials.env';
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf('--output');
const outputArgument = outputIndex >= 0 ? argumentsList[outputIndex + 1] : undefined;
const force = argumentsList.includes('--force');

if (argumentsList.includes('--help')) {
  process.stdout.write(`Usage: npm run setup:admin-credentials [-- --output <.artifacts/private-path> --force]\n\n`);
  process.stdout.write(`Creates a 256-bit admin password and the required PBKDF2 hash in an ignored private file.\n`);
  process.exit(0);
}

if ((outputIndex >= 0 && !outputArgument) || argumentsList.some((argument, index) =>
  argument !== '--force' && argument !== '--output' && index !== outputIndex + 1,
)) {
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
if (existsSync(output) && !force) {
  process.stderr.write(`Refusing to overwrite existing private credentials at ${output}. Use --force only after recording the current password.\n`);
  process.exit(1);
}

const password = randomBytes(passwordBytes).toString('base64url');
const salt = randomBytes(saltBytes);
const derivedKey = await deriveKey(password, salt, iterations, derivedKeyBytes, 'sha256');
const passwordHash = `pbkdf2-sha256$${iterations}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
const outputContent = [
  '# Generated locally by scripts/setup/adminCredentials.mjs.',
  '# Keep this file private; it is ignored by Git. Store ADMIN_PASSWORD in a password manager.',
  `ADMIN_PASSWORD=${password}`,
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
process.stdout.write('Store the password before using ADMIN_SECRET_HASH as a local value or Cloudflare Worker secret.\n');
