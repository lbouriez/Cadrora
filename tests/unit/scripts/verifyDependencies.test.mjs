import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { verifyInstalledDependencies } from '../../../scripts/setup/verifyDependencies.mjs';

describe('setup dependency reuse', () => {
  let root;
  let lock;
  let installed;
  const write = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(value));
  };
  const save = () => {
    write('package-lock.json', lock);
    write('node_modules/.package-lock.json', installed);
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cadrora-deps-'));
    const dependency = { version: '1.0.0', integrity: 'sha512-fixture', resolved: 'https://registry.npmjs.org/demo/-/demo-1.0.0.tgz' };
    lock = { lockfileVersion: 3, packages: { '': { dependencies: { demo: '^1.0.0' } }, 'node_modules/demo': dependency } };
    installed = { lockfileVersion: 3, packages: { 'node_modules/demo': { ...dependency } } };
    write('package.json', { dependencies: { demo: '^1.0.0' } });
    write('node_modules/demo/package.json', { version: '1.0.0' });
    save();
  });
  afterEach(() => {
    expect(root.startsWith(join(tmpdir(), 'cadrora-deps-'))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });
  it('reuses a matching existing installation without a wizard checkpoint', () => {
    expect(verifyInstalledDependencies(root, 'win32', 'x64')).toBe(true);
  });
  it('rejects a different version even within the permitted dependency range', () => {
    installed.packages['node_modules/demo'].version = '1.0.1';
    save();
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
  it('rejects mismatched archive integrity', () => {
    installed.packages['node_modules/demo'].integrity = 'sha512-other';
    save();
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
  it('rejects a missing required package', () => {
    delete installed.packages['node_modules/demo'];
    save();
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
  it('checks the installed files rather than trusting only the hidden lock', () => {
    write('node_modules/demo/package.json', { version: '2.0.0' });
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
  it('allows an absent optional package for another platform', () => {
    lock.packages['node_modules/native'] = { version: '1.0.0', optional: true, os: ['darwin'], cpu: ['arm64'] };
    save();
    expect(verifyInstalledDependencies(root, 'win32', 'x64')).toBe(true);
    expect(verifyInstalledDependencies(root, 'darwin', 'arm64')).toBe(false);
  });
  it('rejects a manifest change not reflected in the lock', () => {
    write('package.json', { dependencies: { demo: '^1.1.0' } });
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
  it('rejects an unexpected installed package', () => {
    installed.packages['node_modules/unexpected'] = { version: '1.0.0' };
    save();
    expect(verifyInstalledDependencies(root)).toBe(false);
  });
});
