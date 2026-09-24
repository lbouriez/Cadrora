import { readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

// The Cloudflare Vite plugin copies local development variables beside the
// built Worker for local preview. They are never needed in release artifacts.
for (const output of ['cadrora', 'client']) {
  const directory = resolve('dist', output);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^(?:\.dev\.vars|\.env)(?:\.[a-z0-9_-]+)*$/iu.test(entry.name)) continue;
    await unlink(resolve(directory, entry.name));
    process.stdout.write(`Removed local development variables from dist/${output}.\n`);
  }
}
