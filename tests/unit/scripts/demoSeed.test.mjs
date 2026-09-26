import { readdirSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { demoMediaUploads, putDemoObject } from '../../../scripts/demo/seed.mjs';

describe('showcase media inventory', () => {
  it('publishes every display variant the public gallery can request', () => {
    const files = readdirSync(new URL('../../../demo/seed/media/', import.meta.url));
    const uploads = demoMediaUploads(files);
    const variantsByPhoto = new Map();

    for (const { file, key } of uploads) {
      const photo = key.slice(0, key.lastIndexOf('/'));
      const variants = variantsByPhoto.get(photo) ?? new Set();
      variants.add(key.slice(key.lastIndexOf('/') + 1));
      variantsByPhoto.set(photo, variants);
      if (key.endsWith('/small.webp')) {
        expect(file).toMatch(/-medium\.webp$/u);
      }
    }

    expect(variantsByPhoto.size).toBe(26);
    for (const variants of variantsByPhoto.values()) {
      expect(variants).toEqual(new Set(['thumb.webp', 'small.webp', 'medium.webp', 'large.webp']));
    }
    expect(() => demoMediaUploads(files.filter((file) => file !== 'public-ceremony-medium.webp')))
      .toThrow('Demo media is incomplete');
  });
});

describe('idempotent showcase R2 uploads', () => {
  it('retries a failed upload and keeps the same object arguments', async () => {
    const args = ['r2', 'object', 'put', 'bucket/demo/photo.webp', '--force'];
    const environment = { CADRORA_SEED_DEMO: 'true' };
    const put = vi.fn().mockImplementationOnce(() => { throw new Error('provider unavailable'); });
    const pause = vi.fn();

    await putDemoObject(args, environment, put, pause);

    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenNthCalledWith(2, args, environment);
    expect(pause).toHaveBeenCalledWith(1500);
  });

  it('fails after three attempts without silently skipping the object', async () => {
    const put = vi.fn(() => { throw new Error('still unavailable'); });
    const pause = vi.fn();

    await expect(putDemoObject(['r2', 'object', 'put', 'bucket/demo/photo.webp', '--force'], {}, put, pause))
      .rejects.toThrow('still unavailable');
    expect(put).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(2);
  });
});
