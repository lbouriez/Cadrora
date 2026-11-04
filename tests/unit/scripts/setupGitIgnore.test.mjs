import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('protects generated private files in a fresh fork without hiding public setup files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cadrora-ignore-'));
  try {
    copyFileSync('.gitignore', join(root, '.gitignore'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    const privateFiles = [
      '.artifacts/instances/my-studio/progress.json',
      '.artifacts/instances/my-studio/progress.json.bak',
      '.artifacts/instances/my-studio/progress.json.tmp',
      '.artifacts/instances/my-studio/setup.json',
      '.artifacts/instances/my-studio/secrets.dpapi.json',
      '.artifacts/instances/my-studio/secrets.dpapi.json.bak',
      '.artifacts/instances/my-studio/admin-credentials.env',
      '.artifacts/instances/my-studio/deploy-secrets.env',
      '.artifacts/instances/my-studio/github-state.json',
      '.artifacts/instances/my-studio/github-request.json',
      '.artifacts/instances/my-studio/github-result.json',
      '.artifacts/instances/my-studio/manifest.json',
      '.artifacts/instances/my-studio/wrangler.json',
      '.artifacts/instances/my-studio/logs/github-errors.log',
      '.artifacts/setup-backups/my-studio/progress.json',
      '.artifacts/setup.lock',
      '.env', '.env.local', '.env.production', '.env.local.bak',
      '.dev.vars', '.dev.vars.preview', '.dev.vars.bak',
      'admin-credentials.env', 'backup/admin-credentials.env.bak',
      'deploy-secrets.env', 'backup/secrets.dpapi.json.bak',
      '.cadrora.remote.wrangler.json', '.cadrora.remote.secrets.env',
    ];
    const publicFiles = [
      'setup.ps1', 'scripts/setup/windows.ps1', '.gitignore',
      '.env.example', '.dev.vars.example',
      '.cadrora/deployments/my-studio.json',
      'sites/my-studio/profile.json', 'sites/my-studio/site.ts',
      '.github/workflows/publish-sites.yml',
    ];
    // A fresh repo with no global excludes proves the rule travels with a fork.
    const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const result = spawnSync('git', ['-c', `core.excludesFile=${nullDevice}`, 'check-ignore', '--no-index', '--stdin'], {
      cwd: root, input: [...privateFiles, ...publicFiles].join('\n') + '\n', encoding: 'utf8', windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split(/\r?\n/u).sort()).toEqual(privateFiles.sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
