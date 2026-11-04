import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyGitHubFailure, githubFailure } from '../../../scripts/setup/githubDiagnostics.mjs';

const directories = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
describe('private GitHub diagnostics', () => {
  it.each([
    ['HTTP 401', 'githubAuthentication', true], ['HTTP 403', 'githubPermissions', true],
    ['HTTP 403: API rate limit exceeded', 'githubRateLimited', true], ['HTTP 429', 'githubRateLimited', true],
    ['HTTP 422', 'githubRequestInvalid', true], ['HTTP 409', 'githubGitConflict', true],
    ['HTTP 502', 'githubProviderUnavailable', false], ['TLS handshake timeout', 'githubNetwork', false],
    ['fatal: non-fast-forward', 'githubGitConflict', false],
  ])('classifies %s without confusing provider failures with permissions', (stderr, key, rejected) => {
    expect(classifyGitHubFailure({ code: 1, stderr })).toMatchObject({ key, requestRejected: rejected });
  });
  it('retains native timeout and missing-tool distinctions', () => {
    expect(classifyGitHubFailure({ code: 1, errorCode: 'ETIMEDOUT' }).key).toBe('githubNetwork');
    expect(classifyGitHubFailure({ code: 1, errorCode: 'ENOENT' })).toMatchObject({ key: 'githubToolMissing', requestRejected: true });
  });
  it('keeps useful UTF-8 diagnostics without tokens, credentials, stdout or request data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cadrora-github-log-')); directories.push(directory);
    writeFileSync(join(directory, 'admin-credentials.env'), 'ADMIN_PASSWORD=local-password-value\nAUTH_PEPPER=local-pepper-value\n');
    const error = githubFailure({ directory, operation: 'github.api.POST', environment: { CLOUDFLARE_API_TOKEN: 'private-token-value' },
      result: { code: 1, stdout: 'private-response-value', stderr: 'HTTP 502: échec réseau\nprivate-token-value local-password-value local-pepper-value\nAuthorization: Bearer unknown-bearer\nghp_ExampleStoredToken123\nhttps://user:password@example.test/path\n' + 'x'.repeat(5000) } });
    expect(error.message).toBe('githubProviderUnavailable');
    const content = readFileSync(error.logPath, 'utf8');
    expect(content).toContain('échec réseau'); expect(content).toContain('github.api.POST');
    expect(JSON.parse(content).httpStatus).toBe(502);
    for (const secret of ['private-token-value', 'local-password-value', 'local-pepper-value', 'private-response-value', 'unknown-bearer', 'ghp_ExampleStoredToken123', 'user:password']) expect(content).not.toContain(secret);
    expect(content).toContain('[REDACTED]'); expect(content).toContain('[Oversized diagnostic omitted]');
  });
  it('fails closed when a diagnostic file cannot be written', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cadrora-github-log-')); directories.push(directory);
    const path = join(directory, 'not-a-directory'); writeFileSync(path, 'fixture');
    const error = githubFailure({ directory: path, operation: 'github.api.POST', environment: {}, result: { code: 1, stderr: 'HTTP 503 private data' } });
    expect(error.message).toBe('githubProviderUnavailable'); expect(error.logPath).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('private data');
  });
});
