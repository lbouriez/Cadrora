import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareRemoteSecrets } from '../../../scripts/release/remoteConfig.mjs';

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal();
  return { ...fs, mkdtemp: vi.fn(fs.mkdtemp), chmod: vi.fn(fs.chmod), writeFile: vi.fn(fs.writeFile) };
});
vi.mock('node:child_process', async (importOriginal) => {
  const childProcess = await importOriginal();
  return { ...childProcess, execFileSync: vi.fn(childProcess.execFileSync) };
});

const realFs = await vi.importActual('node:fs/promises');
const realChildProcess = await vi.importActual('node:child_process');
const credentials = {
  ADMIN_SECRET_HASH: 'dummy-admin-hash',
  AUTH_PEPPER: 'dummy-pepper-with-"quotes"\\and\nnewline',
  TURNSTILE_SECRET_KEY: 'dummy-turnstile-secret',
};
const moduleUrl = pathToFileURL(resolve('scripts/release/remoteConfig.mjs')).href;
const fixtureDirectories = [];

beforeEach(() => {
  vi.mocked(mkdtemp).mockClear();
  vi.mocked(chmod).mockReset().mockImplementation(realFs.chmod);
  vi.mocked(writeFile).mockReset().mockImplementation(realFs.writeFile);
  vi.mocked(execFileSync).mockReset().mockImplementation(realChildProcess.execFileSync);
});

afterEach(async () => {
  const created = await Promise.all(vi.mocked(mkdtemp).mock.results.map((result) => result.value));
  for (const directory of [...created, ...fixtureDirectories.splice(0)]) {
    // Only remove temporary directories this test created, never checkout files.
    expect(dirname(directory)).toBe(resolve(tmpdir()));
    expect(directory).toMatch(/cadrora-(release|secrets-test)-[^\\/]+$/);
    await realFs.rm(directory, { recursive: true, force: true });
  }
});

describe('remote release secrets', () => {
  it('preserves the three-secret format and removes its temporary directory on cleanup', async () => {
    const release = await prepareRemoteSecrets(credentials);
    expect(await readFile(release.secretsPath, 'utf8')).toBe(
      Object.entries(credentials).map(([key, value]) => `${key}=${JSON.stringify(value)}\n`).join(''),
    );
    expect(dirname(release.secretsPath)).not.toBe(process.cwd());
    await release.cleanup();
    await expect(stat(dirname(release.secretsPath))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(release.cleanup()).resolves.toBeUndefined();
  });

  it('keeps simultaneous preparations and their cleanup independent', async () => {
    const first = await prepareRemoteSecrets(credentials);
    const second = await prepareRemoteSecrets(credentials);
    expect(first.secretsPath).not.toBe(second.secretsPath);
    await first.cleanup();
    expect(await readFile(second.secretsPath, 'utf8')).toContain('dummy-admin-hash');
    await second.cleanup();
  });

  it.each(Object.keys(credentials))('rejects missing %s before creating a directory', async (key) => {
    await expect(prepareRemoteSecrets({ ...credentials, [key]: ' ' })).rejects.toThrow(`Missing ${key}`);
    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('does not write secrets if directory protection fails', async () => {
    if (process.platform === 'win32') {
      vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('ACL denied'); });
    } else {
      vi.mocked(chmod).mockRejectedValueOnce(new Error('chmod denied'));
    }
    await expect(prepareRemoteSecrets(credentials)).rejects.toThrow('denied');
    expect(writeFile).not.toHaveBeenCalled();
    const directory = await vi.mocked(mkdtemp).mock.results[0].value;
    await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes partial secrets when writing fails before returning a cleanup handle', async () => {
    vi.mocked(writeFile).mockImplementationOnce(async (path) => {
      await realFs.writeFile(path, 'partial dummy secret');
      throw new Error('write failed');
    });
    await expect(prepareRemoteSecrets(credentials)).rejects.toThrow('write failed');
    const directory = await vi.mocked(mkdtemp).mock.results[0].value;
    await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['file', 'hardlink'])('leaves a pre-existing legacy %s and its target unchanged', async (kind) => {
    const directory = await realFs.mkdtemp(join(resolve(tmpdir()), 'cadrora-secrets-test-'));
    fixtureDirectories.push(directory);
    const legacyPath = join(directory, '.cadrora.remote.secrets.env');
    const targetPath = join(directory, 'existing.txt');
    await realFs.writeFile(targetPath, 'existing content');
    if (kind === 'hardlink') await realFs.link(targetPath, legacyPath);
    else await realFs.writeFile(legacyPath, 'existing content');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { prepareRemoteSecrets } from ${JSON.stringify(moduleUrl)};
      const release = await prepareRemoteSecrets(${JSON.stringify(credentials)});
      await release.cleanup();
    `], { cwd: directory, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(legacyPath, 'utf8')).toBe('existing content');
    expect(await readFile(targetPath, 'utf8')).toBe('existing content');
  });

  it.skipIf(process.platform === 'win32')('keeps POSIX secrets private even with umask 000', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { stat } from 'node:fs/promises';
      import { dirname } from 'node:path';
      import { prepareRemoteSecrets } from ${JSON.stringify(moduleUrl)};
      process.umask(0);
      const release = await prepareRemoteSecrets(${JSON.stringify(credentials)});
      try {
        console.log(JSON.stringify([
          (await stat(dirname(release.secretsPath))).mode & 0o777,
          (await stat(release.secretsPath)).mode & 0o777,
        ]));
      } finally { await release.cleanup(); }
    `], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([0o700, 0o600]);
  });

  it.skipIf(process.platform !== 'win32')('grants Windows directory and file access only to the deploying identity', async () => {
    const release = await prepareRemoteSecrets(credentials);
    const result = realChildProcess.execFileSync(
      join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `
        $ErrorActionPreference = 'Stop'
        $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $fileAcl = Get-Acl -LiteralPath $env:TEST_SECRETS_PATH
        $directoryAcl = Get-Acl -LiteralPath (Split-Path -Parent $env:TEST_SECRETS_PATH)
        $rules = @($fileAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
        @{
          identity = $sid
          protectedDirectory = $directoryAcl.AreAccessRulesProtected
          fileRules = @($rules | ForEach-Object { $_.IdentityReference.Value })
        } | ConvertTo-Json -Compress
      `], { env: { SystemRoot: process.env.SystemRoot, TEST_SECRETS_PATH: release.secretsPath }, encoding: 'utf8' },
    );
    const acl = JSON.parse(result);
    expect(acl.protectedDirectory).toBe(true);
    expect(acl.fileRules).toEqual([acl.identity]);
    const aclChildEnvironment = vi.mocked(execFileSync).mock.calls[0][2].env;
    for (const key of Object.keys(credentials)) expect(aclChildEnvironment).not.toHaveProperty(key);
    await release.cleanup();
  });
});
