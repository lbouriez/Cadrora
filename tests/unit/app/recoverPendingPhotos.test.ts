import { describe, expect, it, vi } from 'vitest';

import { recoverPendingPhotos } from '../../../src/browser/jobs/RecoverPendingPhotos';
import { sourceSha256 } from '../../../src/browser/jobs/sourceFile';
import type { EncodedVariant, ImageEncoder } from '../../../src/browser/images';
import type { ImportApi } from '../../../src/browser/jobs/ImportApi';
import type { RecoverablePhoto } from '../../../src/shared/schemas';

function encoder(): ImageEncoder {
  return {
    dispose: vi.fn(),
    encode: vi.fn(() => Promise.resolve({
      height: 600,
      sourceContentType: 'image/jpeg' as const,
      variants: (['thumb', 'small', 'medium', 'large', 'download'] as const).map((name) => ({
        blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
        byteSize: 4,
        checksumSha256: 'a'.repeat(64),
        contentType: 'image/jpeg' as const,
        height: 600,
        name,
        width: 400,
      })),
      width: 400,
    })),
  };
}

describe('recoverPendingPhotos', () => {
  it('matches exact source bytes and uploads only missing variants before finalizing', async () => {
    const original = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 1])], 'original.jpg', { type: 'image/jpeg' });
    const wrong = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 2])], 'same-name.jpg', { type: 'image/jpeg' });
    const pending: RecoverablePhoto[] = [{
      id: 'photo-1', filename: original.name, sourceSha256: await sourceSha256(original),
      keepOriginals: false, missingVariants: ['large', 'download'],
    }];
    const uploaded: string[] = [];
    const api: Pick<ImportApi, 'finalizePhoto' | 'getRecoverablePhotos' | 'uploadVariant'> = {
      getRecoverablePhotos: vi.fn(() => Promise.resolve([...pending])),
      uploadVariant: vi.fn((_photoId: string, variant: EncodedVariant) => { uploaded.push(variant.name); return Promise.resolve(); }),
      finalizePhoto: vi.fn(() => { pending.splice(0, 1); return Promise.resolve(); }),
    };
    const progress = vi.fn();

    const result = await recoverPendingPhotos(api, 'gallery-1', [wrong, original], {
      createEncoder: encoder, onProgress: progress,
    });

    expect(result).toEqual({ recovered: 1, remaining: [] });
    expect(uploaded.sort()).toEqual(['download', 'large']);
    expect(api.finalizePhoto).toHaveBeenCalledWith('photo-1', undefined);
    expect(progress).toHaveBeenCalledWith(1, 1);
  });

  it('keeps unmatched pending photos available for a later selection', async () => {
    const original = new File([new Uint8Array([1, 2, 3])], 'original.jpg', { type: 'image/jpeg' });
    const pending: RecoverablePhoto = {
      id: 'photo-1', filename: original.name, sourceSha256: await sourceSha256(original),
      keepOriginals: false, missingVariants: ['large'],
    };
    const api: Pick<ImportApi, 'finalizePhoto' | 'getRecoverablePhotos' | 'uploadVariant'> = {
      getRecoverablePhotos: vi.fn(() => Promise.resolve([pending])),
      uploadVariant: vi.fn(() => Promise.resolve()),
      finalizePhoto: vi.fn(() => Promise.resolve()),
    };

    const result = await recoverPendingPhotos(api, 'gallery-1', [new File(['different'], 'original.jpg')], {
      createEncoder: encoder,
    });

    expect(result).toEqual({ recovered: 0, remaining: [pending] });
    expect(api.uploadVariant).not.toHaveBeenCalled();
    expect(api.finalizePhoto).not.toHaveBeenCalled();
  });

  it('retries after a partial upload without sending variants already recorded in D1', async () => {
    const original = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 3])], 'original.jpg', { type: 'image/jpeg' });
    const hash = await sourceSha256(original);
    const missing = new Set<RecoverablePhoto['missingVariants'][number]>(['large', 'download']);
    const sent: string[] = [];
    let failDownload = true;
    let finalized = false;
    const api: Pick<ImportApi, 'finalizePhoto' | 'getRecoverablePhotos' | 'uploadVariant'> = {
      getRecoverablePhotos: () => Promise.resolve(finalized ? [] : [{
        id: 'photo-1', filename: original.name, sourceSha256: hash,
        keepOriginals: false, missingVariants: [...missing],
      }]),
      uploadVariant: (_photoId, variant) => {
        sent.push(variant.name);
        if (variant.name === 'download' && failDownload) return Promise.reject(new Error('temporary failure'));
        missing.delete(variant.name);
        return Promise.resolve();
      },
      finalizePhoto: () => { finalized = true; return Promise.resolve(); },
    };

    await expect(recoverPendingPhotos(api, 'gallery-1', [original], { createEncoder: encoder }))
      .rejects.toThrow('temporary failure');
    expect([...missing]).toEqual(['download']);

    failDownload = false;
    await expect(recoverPendingPhotos(api, 'gallery-1', [original], { createEncoder: encoder }))
      .resolves.toEqual({ recovered: 1, remaining: [] });
    expect(sent.filter((name) => name === 'large')).toHaveLength(1);
    expect(sent.filter((name) => name === 'download')).toHaveLength(2);
  });
});
