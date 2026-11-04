import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Windows guided setup', () => {
  it('provides matching English and French prompts', () => {
    const english = JSON.parse(readFileSync('scripts/setup/messages.en.json', 'utf8'));
    const french = JSON.parse(readFileSync('scripts/setup/messages.fr.json', 'utf8'));
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(english)) {
      expect(french[key].length).toBeGreaterThan(0);
      expect(french[key].match(/\{\d+\}/gu)).toEqual(value.match(/\{\d+\}/gu));
    }
  });
  it('provides matching GitHub guidance and placeholders in both languages', () => {
    const english = JSON.parse(readFileSync('scripts/setup/messages.github.en.json', 'utf8'));
    const french = JSON.parse(readFileSync('scripts/setup/messages.github.fr.json', 'utf8'));
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(english)) expect(french[key].match(/\{\d+\}/gu)).toEqual(value.match(/\{\d+\}/gu));
  });
  const shells = [
    ['Windows PowerShell 5.1', join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')],
    ['PowerShell 7', join(process.env.ProgramFiles ?? 'C:/Program Files', 'PowerShell/7/pwsh.exe')],
  ];
  for (const [name, shell] of shells) {
    it.skipIf(process.platform !== 'win32' || !existsSync(shell))(`resumes GitHub publication without replaying writes in ${name}`, () => {
      const environment = { ...process.env, CADRORA_TEST_NODE: process.execPath };
      for (const key of Object.keys(environment)) if (key.toLowerCase() === 'psmodulepath') delete environment[key];
      const output = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'tests/scripts/windowsGitHubSetup.ps1'], {
        encoding: 'utf8', env: environment, timeout: 20_000,
      });
      expect(output).toContain('Windows GitHub setup checks passed');
    }, 20_000);
    it.skipIf(process.platform !== 'win32' || !existsSync(shell))(`logs native commands and preserves Windows failure codes in ${name}`, () => {
      const environment = { ...process.env, CADRORA_TEST_NODE: process.execPath };
      for (const key of Object.keys(environment)) if (key.toLowerCase() === 'psmodulepath') delete environment[key];
      const output = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'tests/scripts/windowsSetupLogging.ps1'], {
        encoding: 'utf8', env: environment, timeout: 20_000,
      });
      expect(output).toContain('Windows setup logging checks passed');
    }, 20_000);
    it.skipIf(process.platform !== 'win32' || !existsSync(shell))(`renders a read-only FR/EN preview and visible defaults in ${name}`, () => {
      const environment = { ...process.env };
      for (const key of Object.keys(environment)) if (key.toLowerCase() === 'psmodulepath') delete environment[key];
      const output = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'tests/scripts/windowsSetupUi.ps1'], {
        encoding: 'utf8', env: environment, timeout: 10_000,
      });
      expect(output).toContain('Windows setup UI checks passed');
    });
    it.skipIf(process.platform !== 'win32' || !existsSync(shell))(`exercises offline orchestration and real private-folder permissions in ${name}`, () => {
      const environment = { ...process.env, CADRORA_TEST_NODE: process.execPath };
      // Node does not perform PowerShell 7's module-path cleanup when starting 5.1.
      for (const key of Object.keys(environment)) if (key.toLowerCase() === 'psmodulepath') delete environment[key];
      const output = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'tests/scripts/windowsSetup.ps1'], {
        encoding: 'utf8', env: environment, timeout: 60_000,
      });
      expect(output).toContain('Windows setup offline checks passed');
    }, 65_000);
  }
});
