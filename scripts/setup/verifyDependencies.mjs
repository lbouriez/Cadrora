import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameMap = (left = {}, right = {}) => object(left) && object(right)
  && Object.keys(left).length === Object.keys(right).length
  && Object.entries(left).every(([key, value]) => right[key] === value);
const supports = (list, value) => !list || (Array.isArray(list)
  && !list.includes(`!${value}`)
  && (list.includes('any') || list.includes(value) || list.every((item) => item.startsWith('!'))));

// Runs before dependency installation; use only Node built-ins. A usable tree
// must match the lock, not merely satisfy the package.json version ranges.
export function verifyInstalledDependencies(root, platform = process.platform, arch = process.arch) {
  try {
    const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
    const manifest = read(resolve(root, 'package.json'));
    const lock = read(resolve(root, 'package-lock.json'));
    const installed = read(resolve(root, 'node_modules/.package-lock.json'));
    if (lock.lockfileVersion !== 3 || installed.lockfileVersion !== 3
      || !object(lock.packages) || !object(installed.packages) || !object(lock.packages[''])) return false;
    for (const kind of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      if (!sameMap(manifest[kind], lock.packages[''][kind])) return false;
    }
    for (const path of Object.keys(installed.packages)) {
      if (path && !object(lock.packages[path])) return false;
    }
    const modules = resolve(root, 'node_modules') + sep;
    for (const [path, expected] of Object.entries(lock.packages)) {
      if (!path) continue;
      const directory = resolve(root, path);
      if (!path.startsWith('node_modules/') || !directory.startsWith(modules)
        || !object(expected) || expected.link || expected.inBundle) return false;
      const actual = installed.packages[path];
      if (!actual && expected.optional && (!supports(expected.os, platform) || !supports(expected.cpu, arch))) continue;
      if (!object(actual) || actual.link || ['version', 'integrity', 'resolved'].some((key) => actual[key] !== expected[key])) return false;
      if (read(resolve(directory, 'package.json')).version !== expected.version) return false;
    }
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = process.argv[2] && verifyInstalledDependencies(process.argv[2]) ? 0 : 1;
}
