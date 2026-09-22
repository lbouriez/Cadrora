import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

import { applyOrientationTransform, constrainedDimensions, encodePhoto } from '../../../src/browser/images/encoder';
import { readExifCapturedAt, readExifOrientation, sniffImageType } from '../../../src/browser/images/format';

function jpegWithOrientation(orientation: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
  bytes.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], 12);
  bytes.set([0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00], 20);
  bytes.set([0x00, 0x00, 0x00, 0x00, 0xff, 0xd9], 34);
  return bytes;
}

describe('browser import image guards', () => {
  it('accepts only JPEG, PNG, and WebP byte signatures', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([0x00, 0x01, 0x02]))).toBeUndefined();
  });

  it('reads all eight EXIF orientation values and treats malformed metadata as normal', () => {
    for (let orientation = 1; orientation <= 8; orientation += 1) {
      expect(readExifOrientation(jpegWithOrientation(orientation))).toBe(orientation);
    }
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))).toBe(1);
  });

  it('reads DateTimeOriginal and uses the gallery timezone when the camera has no offset', async () => {
    const bytes = await sharp({
      create: { background: '#d8b08c', channels: 3, height: 2, width: 2 },
    }).jpeg().withExif({ IFD2: { DateTimeOriginal: '2026:08:30 14:02:00' } }).toBuffer();

    expect(readExifCapturedAt(bytes, 'America/Toronto')).toBe('2026-08-30T18:02:00.000Z');
    expect(readExifCapturedAt(bytes, 'Not/A_Timezone')).toBeUndefined();
  });

  it('rejects a malformed camera offset instead of guessing a different instant', async () => {
    const bytes = await sharp({
      create: { background: '#d8b08c', channels: 3, height: 2, width: 2 },
    }).jpeg().withExif({
      IFD2: { DateTimeOriginal: '2026:08:30 14:02:00', OffsetTimeOriginal: 'invalid' },
    }).toBuffer();

    expect(readExifCapturedAt(bytes, 'America/Toronto')).toBeUndefined();
  });

  it('uses the EXIF 6 matrix once and never upscales constrained variants', () => {
    const transforms: number[][] = [];
    const context = {
      setTransform: (...values: number[]) => transforms.push(values),
    };
    // This isolated test double only observes the CanvasRenderingContext2D method under test.
    applyOrientationTransform(context as unknown as CanvasRenderingContext2D, 6, 4000, 3000);

    expect(transforms).toEqual([[0, 1, -1, 0, 3000, 0]]);
    expect(constrainedDimensions(640, 480, 960)).toEqual({ width: 640, height: 480 });
    expect(constrainedDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('draws source pixels into fresh encodings, so private EXIF text is never uploaded', async () => {
    const imageOrientation = vi.fn();
    vi.stubGlobal('createImageBitmap', (_file: File, options: ImageBitmapOptions) => {
      imageOrientation(options.imageOrientation);
      return Promise.resolve({ close: vi.fn(), height: 3000, width: 4000 } as unknown as ImageBitmap);
    });
    class FakeOffscreenCanvas {
      readonly height: number;
      readonly width: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      convertToBlob(options: ImageEncodeOptions): Promise<Blob> {
        // A JPEG response for every requested type exercises the WebP MIME/magic fallback.
        return Promise.resolve(
          new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: options.type ?? 'image/jpeg' }),
        );
      }

      getContext(): OffscreenCanvasRenderingContext2D {
        return { drawImage: vi.fn(), setTransform: vi.fn() } as unknown as OffscreenCanvasRenderingContext2D;
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);

    try {
      const source = new Uint8Array([...jpegWithOrientation(6), ...new TextEncoder().encode('GPS SERIAL PRIVATE COMMENT')]);
      const file = new File([source], 'private.jpg', { type: 'image/jpeg' });
      const encoded = await encodePhoto(file);

      expect(imageOrientation).toHaveBeenCalledWith('none');
      expect(encoded.variants).toHaveLength(5);
      expect(encoded.variants.every((variant) => variant.contentType === 'image/jpeg')).toBe(true);
      const output = (await Promise.all(encoded.variants.map((variant) => variant.blob.text()))).join('');
      expect(output).not.toContain('GPS');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
