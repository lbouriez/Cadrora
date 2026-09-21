import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { runWrangler } from '../release/target.mjs';

const mediaDirectory = 'demo/seed/media';
const objectKeyByFile = new Map([
  ['public-dance-thumb.webp', 'demo/public/dance/1/thumb.webp'],
  ['public-dance-medium.webp', 'demo/public/dance/1/medium.webp'],
  ['public-dance-large.webp', 'demo/public/dance/1/large.webp'],
  ['public-ceremony-thumb.webp', 'demo/public/ceremony/1/thumb.webp'],
  ['public-ceremony-medium.webp', 'demo/public/ceremony/1/medium.webp'],
  ['public-ceremony-large.webp', 'demo/public/ceremony/1/large.webp'],
  ['private-family-thumb.webp', 'demo/private/family/1/thumb.webp'],
  ['private-family-medium.webp', 'demo/private/family/1/medium.webp'],
  ['private-family-large.webp', 'demo/private/family/1/large.webp'],
  ['private-newborn-thumb.webp', 'demo/private/newborn/1/thumb.webp'],
  ['private-newborn-medium.webp', 'demo/private/newborn/1/medium.webp'],
  ['private-newborn-large.webp', 'demo/private/newborn/1/large.webp'],
]);

for (let number = 1; number <= 10; number += 1) {
  const photo = String(number).padStart(2, '0');
  for (const variant of ['thumb', 'medium', 'large']) {
    objectKeyByFile.set(
      `ai-demo-${photo}-${variant}.webp`,
      `demo/ai-face-search/${photo}/1/${variant}.webp`,
    );
  }
}

function mediaBucketVariable(target) {
  return target.cloudflareEnv ? 'CADRORA_PREVIEW_MEDIA_BUCKET_NAME' : 'CADRORA_MEDIA_BUCKET_NAME';
}

function modelsBucketVariable(target) {
  return target.cloudflareEnv ? 'CADRORA_PREVIEW_MODELS_BUCKET_NAME' : 'CADRORA_MODELS_BUCKET_NAME';
}

function faceIndexName(target) {
  return target.cloudflareEnv ? 'cadrora-preview-face-index' : 'cadrora-face-index';
}

export async function seedFaceSearchDemo(target) {
  const directory = '.artifacts/demo';
  const vectorFile = join(directory, 'ai-face-search-vectors.ndjson');
  const namespace = 'face:demo-ai-face-search:generation:0';
  const partitionId = 'demo-ai-face-partition-0';
  const vectors = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-ai-face-search:0:demo-face-${String(index + 1).padStart(2, '0')}`,
    namespace,
    values: Array.from({ length: 128 }, (_, dimension) => (dimension === index ? 1 : 0)),
    metadata: { partition_id: partitionId },
  }));
  await mkdir(directory, { recursive: true });
  await writeFile(vectorFile, `${vectors.map((vector) => JSON.stringify(vector)).join('\n')}\n`, 'utf8');
  runWrangler(['vectorize', 'upsert', faceIndexName(target), '--file', vectorFile]);
}

function syncFaceModels(target, configPath, environment) {
  const bucketVariable = modelsBucketVariable(target);
  const bucketName = environment[bucketVariable]?.trim();
  if (!bucketName) throw new Error(`Face-search demo seeding requires ${bucketVariable}.`);
  const download = spawnSync(process.execPath, ['scripts/models/download.mjs'], { env: environment, stdio: 'inherit' });
  if (download.error || download.status !== 0) throw download.error ?? new Error('Face-model download failed.');
  for (const filename of ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx']) {
    runWrangler([
      'r2', 'object', 'put', `${bucketName}/models/v1/${filename}`,
      '--file', join('.artifacts/models', filename),
      '--content-type', 'application/octet-stream',
      '--remote', '--config', configPath, ...target.migrationArgs,
    ], environment);
  }
}

export async function seedDemoContent(target, configPath, environment = process.env) {
  if (environment.CADRORA_SEED_DEMO?.trim().toLowerCase() !== 'true') return;
  const bucketVariable = mediaBucketVariable(target);
  const bucketName = environment[bucketVariable]?.trim();
  if (!bucketName) throw new Error(`Demo seeding requires ${bucketVariable}.`);

  const files = await readdir(mediaDirectory);
  const selected = files.filter((file) => objectKeyByFile.has(file)).sort();
  if (selected.length !== objectKeyByFile.size) {
    throw new Error('Demo media is incomplete. Restore every tracked file under demo/seed/media.');
  }

  process.stdout.write(`Uploading ${selected.length} generated demo variants to the private media bucket.\n`);
  for (const file of selected) {
    const objectKey = objectKeyByFile.get(file);
    runWrangler([
      'r2', 'object', 'put', `${bucketName}/${objectKey}`,
      '--file', join(mediaDirectory, file),
      '--content-type', 'image/webp',
      '--remote', '--config', configPath,
      ...target.migrationArgs,
    ], environment);
  }

  syncFaceModels(target, configPath, environment);

  process.stdout.write(`Applying idempotent demo records to ${target.label} D1.\n`);
  runWrangler([
    'd1', 'execute', 'DB', '--remote', '--file', 'demo/seed/demo.sql',
    '--config', configPath, ...target.migrationArgs,
  ], environment);
  await seedFaceSearchDemo(target);
}
