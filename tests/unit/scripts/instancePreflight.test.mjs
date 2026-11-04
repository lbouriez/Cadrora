import { createHmac } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkInstallation, validateSavedCredentials } from '../../../scripts/setup/instancePreflight.mjs';

const accountId = 'a'.repeat(32);
const target = { instance: 'example', hostname: 'photos.example.com' };
const environment = { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: 'test-token', TURNSTILE_SECRET_KEY: 'private-test-fixture' };
const folders = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function workspace() {
  const folder = mkdtempSync(join(tmpdir(), 'cadrora-preflight-test-'));
  folders.push(folder);
  mkdirSync(join(folder, '.artifacts/instances/example'), { recursive: true });
  return folder;
}
function credentials() {
  const pepper = 'p'.repeat(43);
  const salt = 's'.repeat(43);
  const hash = createHmac('sha256', `cadrora-password-admin-v1:${pepper}`).update(`${salt}:fixture-password`).digest('base64url');
  return `ADMIN_PASSWORD=fixture-password\nAUTH_PEPPER=${pepper}\nADMIN_SECRET_HASH=hmac-sha256$${salt}$${hash}\n`;
}
function provider({ existing = false, r2Status = 200, active = true } = {}) {
  return vi.fn(async (url) => {
    const address = String(url);
    if (address.includes('/zones?')) return Response.json({ success: true, result: address.includes('name=example.com')
      ? [{ name: 'example.com', account: { id: accountId }, status: active ? 'active' : 'pending', id: 'zone-id' }] : [] });
    if (address.endsWith('/r2/buckets')) return Response.json({ success: true, result: { buckets: [] } }, { status: r2Status });
    if (address.endsWith('/workers/scripts')) return Response.json({ success: true, result: existing ? [{ id: 'cadrora-example' }] : [] });
    throw new Error('Unexpected provider request');
  });
}

describe('guided installation preflight', () => {
  it('checks a new target using only reads and sends the token only in authorization', async () => {
    const fetcher = provider();
    await checkInstallation({ target, environment, workspace: workspace(), fetcher });
    for (const [url, options] of fetcher.mock.calls) {
      expect(String(url)).not.toContain(environment.CLOUDFLARE_API_TOKEN);
      expect(options.method ?? 'GET').toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer test-token');
    }
  });
  it('refuses to replace a live Worker credential when the original file is missing', async () => {
    await expect(checkInstallation({ target, environment, workspace: workspace(), fetcher: provider({ existing: true }) })).rejects.toThrow('local credentials are missing');
  });
  it('permits a retry with the original matching credentials', async () => {
    const folder = workspace();
    writeFileSync(join(folder, '.artifacts/instances/example/admin-credentials.env'), credentials());
    await checkInstallation({ target, environment, workspace: folder, fetcher: provider({ existing: true }) });
  });
  it('fails before remote checks when a saved password no longer matches its verifier', async () => {
    const folder = workspace();
    writeFileSync(join(folder, '.artifacts/instances/example/admin-credentials.env'), credentials().replace('fixture-password', 'changed'));
    const fetcher = provider();
    await expect(checkInstallation({ target, environment, workspace: folder, fetcher })).rejects.toThrow('do not match');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects incomplete credentials without exposing their values', () => {
    expect(() => validateSavedCredentials('ADMIN_PASSWORD=do-not-print')).toThrow('incomplete');
  });
  it('refuses a manifest for another hostname before contacting Cloudflare', async () => {
    const folder = workspace();
    writeFileSync(join(folder, '.artifacts/instances/example/manifest.json'), JSON.stringify({ ...target, hostname: 'other.example.com' }));
    const fetcher = provider();
    await expect(checkInstallation({ target, environment, workspace: folder, fetcher })).rejects.toThrow('original hostname');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ r2Status: 403 }, { active: false }])('stops on inaccessible prerequisites: %j', async (options) => {
    const fetcher = provider(options);
    await expect(checkInstallation({ target, environment, workspace: workspace(), fetcher })).rejects.toThrow();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/workers/scripts'))).toBe(false);
  });
  it('rejects test Turnstile secrets before remote calls', async () => {
    const fetcher = provider();
    await expect(checkInstallation({ target, environment: { ...environment, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' }, workspace: workspace(), fetcher })).rejects.toThrow('test credentials');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
