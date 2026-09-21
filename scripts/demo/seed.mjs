import { readdir } from 'node:fs/promises';
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

function mediaBucketVariable(target) {
  return target.cloudflareEnv ? 'CADRORA_PREVIEW_MEDIA_BUCKET_NAME' : 'CADRORA_MEDIA_BUCKET_NAME';
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

  process.stdout.write(`Applying idempotent demo records to ${target.label} D1.\n`);
  runWrangler([
    'd1', 'execute', 'DB', '--remote', '--file', 'demo/seed/demo.sql',
    '--config', configPath, ...target.migrationArgs,
  ], environment);
}
