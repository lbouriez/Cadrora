import { readdir, stat } from 'node:fs/promises';

const directory = new URL('../../public/brand/', import.meta.url);
const maxBytes = 350_000;
const images = (await readdir(directory)).filter((name) => /\.(?:avif|jpe?g|png|webp)$/iu.test(name));
const oversized = [];
for (const name of images) {
  const { size } = await stat(new URL(name, directory));
  if (size > maxBytes) oversized.push(`${name}: ${size} bytes`);
}
if (oversized.length) {
  throw new Error(`Optimize brand images before building (limit ${maxBytes} bytes):\n${oversized.join('\n')}`);
}
