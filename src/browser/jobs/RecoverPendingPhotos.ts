import { createImageEncoder, validateImageFile, type ImageEncoder } from '../images';
import type { RecoverablePhoto } from '../../shared/schemas';
import { ConcurrencyLimiter, mapWithConcurrency } from './concurrency';
import type { ImportApi } from './ImportApi';
import { originalVariant, sourceSha256 } from './sourceFile';

export interface ImportRecoveryResult {
  recovered: number;
  remaining: RecoverablePhoto[];
}

/** Rebuild only missing variants from exact original files when the local import journal is gone. */
export async function recoverPendingPhotos(
  api: Pick<ImportApi, 'finalizePhoto' | 'getRecoverablePhotos' | 'uploadVariant'>,
  eventId: string,
  files: File[],
  options: {
    createEncoder?: () => ImageEncoder;
    onProgress?: (completed: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ImportRecoveryResult> {
  const pending = await api.getRecoverablePhotos(eventId);
  const hashes = new Set(pending.filter((photo) => photo.missingVariants.length > 0).map((photo) => photo.sourceSha256));
  const matches = new Map<string, File>();
  await mapWithConcurrency(files, 2, async (file) => {
    const hash = await sourceSha256(file);
    if (hashes.has(hash)) matches.set(hash, file);
  });
  const recoverable = pending.filter((photo) => photo.missingVariants.length === 0 || matches.has(photo.sourceSha256));
  const encoder = (options.createEncoder ?? createImageEncoder)();
  const uploads = new ConcurrencyLimiter(3);
  let recovered = 0;
  try {
    for (const photo of recoverable) {
      if (options.signal?.aborted) throw new DOMException('Recovery cancelled.', 'AbortError');
      if (photo.missingVariants.length > 0) {
        const file = matches.get(photo.sourceSha256)!;
        const encoded = await encoder.encode(file);
        const original = photo.missingVariants.includes('original')
          ? [await originalVariant(file, await validateImageFile(file))]
          : [];
        const missing = new Set(photo.missingVariants);
        await Promise.all([...encoded.variants, ...original]
          .filter((variant) => missing.has(variant.name))
          .map((variant) => uploads.run(() => api.uploadVariant(photo.id, variant, options.signal))));
      }
      await api.finalizePhoto(photo.id, options.signal);
      recovered += 1;
      options.onProgress?.(recovered, recoverable.length);
    }
  } finally {
    encoder.dispose();
  }
  return { recovered, remaining: await api.getRecoverablePhotos(eventId) };
}
