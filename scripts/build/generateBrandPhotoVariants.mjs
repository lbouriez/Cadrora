import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../../', import.meta.url);
const dimensions = JSON.parse(await readFile(new URL('src/shared/brand-photo-dimensions.json', root), 'utf8'));
const output = new URL('public/brand/responsive/', root);
await mkdir(output, { recursive: true });

for (const [url, expected] of Object.entries(dimensions)) {
  if (!/^\/(?:brand\/[a-z0-9-]+|demo\/face-search\/test-portrait-[a-z0-9-]+)\.webp$/u.test(url)) throw new Error(`Invalid brand photo path: ${url}`);
  const filename = url.slice(url.startsWith('/brand/') ? '/brand/'.length : 1).replaceAll('/', '-');
  const input = fileURLToPath(new URL(`public${url}`, root));
  const actual = await sharp(input).metadata();
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`Update brand-photo-dimensions.json for ${filename}: expected ${expected.width}x${expected.height}, found ${actual.width}x${actual.height}`);
  }
  const widths = url.startsWith('/demo/') ? [64, 128, 320, 640, 960, 1280] : [320, 640, 960, 1280];
  for (const width of widths) {
    if (width >= expected.width) continue;
    const bytes = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toBuffer();
    await writeFile(new URL(`${filename.slice(0, -5)}-${width}.webp`, output), bytes);
  }
}
