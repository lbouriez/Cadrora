import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(fixtureDirectory, '..', '..');
const source = join(repositoryRoot, 'demo', 'seed', 'media', 'ai-demo-11-large.webp');
const destination = join(fixtureDirectory, 'nearby-amelia-exif.jpg');

await mkdir(fixtureDirectory, { recursive: true });
await sharp(source)
  .jpeg({ quality: 88 })
  .withExif({
    IFD0: { Orientation: '1' },
    IFD2: {
      DateTimeOriginal: '2026:08:30 14:02:00',
      OffsetTimeOriginal: '-04:00',
    },
  })
  .toFile(destination);

process.stdout.write(`${destination}\n`);
