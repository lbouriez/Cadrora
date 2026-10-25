import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('setup Node security prerequisites', () => {
  it.each([
    ['20.20.2', false],
    ['22.23.3', false],
    ['22.23.4', true],
    ['22.24.0', true],
    ['23.11.1', false],
    ['24.22.0', false],
    ['24.22.1', true],
    ['24.23.0', true],
    ['26.12.1', false],
  ])('classifies Node %s as supported=%s', (version, supported) => {
    const preload = `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} });`;
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
      'scripts/setup/index.mjs', '--diagnose',
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain(`[${supported ? 'ok' : 'error'}] Node.js:`);
    expect(result.stdout).toContain(version);
  });
});
