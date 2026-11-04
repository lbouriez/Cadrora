import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyAccountZone } from '../instances/accountPreflight.mjs';
import { assertManifestTarget, instanceResourceNames, parseInstanceArguments } from '../instances/instanceConfig.mjs';

export function validateSavedCredentials(content) {
  const values = Object.fromEntries(content.split(/\r?\n/u).filter((line) => /^[A-Z_]+=/u.test(line)).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const [algorithm, salt, hash, extra] = (values.ADMIN_SECRET_HASH ?? '').split('$');
  if (!values.ADMIN_PASSWORD || Buffer.byteLength(values.AUTH_PEPPER ?? '') < 32
    || algorithm !== 'hmac-sha256' || !/^[A-Za-z0-9_-]{43}$/u.test(salt ?? '')
    || !/^[A-Za-z0-9_-]{43}$/u.test(hash ?? '') || extra !== undefined) {
    throw new Error('Saved admin credentials are incomplete. Restore the original private credential file; do not regenerate it.');
  }
  const expected = createHmac('sha256', `cadrora-password-admin-v1:${values.AUTH_PEPPER}`)
    .update(`${salt}:${values.ADMIN_PASSWORD}`, 'utf8').digest();
  const actual = Buffer.from(hash, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Saved admin credentials do not match. Restore the original private credential file.');
  }
}

export async function checkInstallation({ target, environment = process.env, workspace = process.cwd(), fetcher = fetch }) {
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
  const token = environment.CLOUDFLARE_API_TOKEN;
  if (/^[123]x00000000000000000000/u.test(environment.TURNSTILE_SECRET_KEY ?? '')) {
    throw new Error('Turnstile test credentials are not allowed for deployment.');
  }
  const directory = resolve(workspace, '.artifacts', 'instances', target.instance);
  const credentialPath = resolve(directory, 'admin-credentials.env');
  const hasCredentials = existsSync(credentialPath);
  if (hasCredentials) validateSavedCredentials(readFileSync(credentialPath, 'utf8'));
  const manifest = resolve(directory, 'manifest.json');
  if (existsSync(manifest)) {
    assertManifestTarget(JSON.parse(readFileSync(manifest, 'utf8')), target);
    if (!hasCredentials) throw new Error('This installation has lost its local credentials. Restore them before deploying again.');
  }
  await verifyAccountZone({ accountId, hostname: target.hostname, token, fetcher });
  async function get(path, label) {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${label} check failed (HTTP ${response.status}). Check token permissions and R2 activation before retrying.`);
    const body = await response.json();
    if (body.success !== true || !body.result) throw new Error(`${label} check returned an invalid response.`);
    return body.result;
  }
  const buckets = await get('r2/buckets', 'R2');
  if (!Array.isArray(buckets.buckets)) throw new Error('R2 check returned an invalid bucket list.');
  const scripts = await get('workers/scripts', 'Workers');
  if (!Array.isArray(scripts)) throw new Error('Workers check returned an invalid script list.');
  const worker = instanceResourceNames(target.instance).worker;
  if (!hasCredentials && scripts.some((script) => script.id === worker)) {
    throw new Error('This Worker already exists but its local credentials are missing. Restore the original credentials or use a new installation name.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await checkInstallation({ target: parseInstanceArguments(process.argv.slice(2)) });
    process.stdout.write('Account, active zone, R2, Worker discovery and local credential checks passed.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Installation preflight failed.'}\n`);
    process.exitCode = 1;
  }
}
