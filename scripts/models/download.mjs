import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(resolve(scriptDirectory, 'manifest.json'), 'utf8'));
const outputArgument = process.argv.indexOf('--output');
const outputDirectory = resolve(
  process.cwd(),
  outputArgument >= 0 && process.argv[outputArgument + 1] ? process.argv[outputArgument + 1] : '.artifacts/models',
);

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function validExisting(path, model) {
  try {
    const details = await stat(path);
    return details.size === model.byteSize && await sha256(path) === model.sha256;
  } catch {
    return false;
  }
}

await mkdir(outputDirectory, { recursive: true });
for (const model of manifest.models) {
  const filename = model.storageKey.split('/').at(-1);
  if (!filename) throw new Error(`Invalid storage key for ${model.id}`);
  const destination = resolve(outputDirectory, filename);
  if (await validExisting(destination, model)) {
    process.stdout.write(`${model.id}: verified existing ${destination}\n`);
    continue;
  }
  const temporary = `${destination}.partial`;
  await rm(temporary, { force: true });
  const response = await fetch(model.sourceUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${model.id}: download failed with HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== model.byteSize) {
    throw new Error(`${model.id}: expected ${model.byteSize} bytes, received ${bytes.byteLength}`);
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== model.sha256) throw new Error(`${model.id}: SHA-256 mismatch`);
  await rm(destination, { force: true });
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, destination);
  process.stdout.write(`${model.id}: verified ${destination}\n`);
}

await writeFile(
  resolve(outputDirectory, 'upload-manifest.json'),
  `${JSON.stringify({ version: manifest.version, generatedAt: new Date().toISOString(), models: manifest.models.map((model) => ({
    id: model.id,
    localFile: model.storageKey.split('/').at(-1),
    storageKey: model.storageKey,
    byteSize: model.byteSize,
    sha256: model.sha256,
    license: model.license,
    version: model.version,
    dimensions: model.dimensions,
    preprocessing: model.preprocessing,
    metric: model.metric,
    immutableUrl: model.immutableUrl,
    sizeBudgetBytes: model.sizeBudgetBytes,
  })) }, null, 2)}\n`,
);
process.stdout.write(`Upload-ready manifest: ${resolve(outputDirectory, 'upload-manifest.json')}\n`);
