import { ApiException } from '../../shared/errors/ApiError';

export interface VerifiedImageUpload {
  byteSize: number;
  checksumSha256: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export function contentTypeWithoutParameters(value: string | undefined): string | undefined {
  return value?.split(';', 1)[0]?.trim().toLowerCase();
}

export function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function sniffEncodedMime(bytes: Uint8Array): VerifiedImageUpload['contentType'] | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return undefined;
}

export function isR2ChecksumMismatch(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 10037;
}

/** Inspect a small prefix, then forward the other branch as a known-length stream to R2. */
export async function putVerifiedImage(bucket: R2Bucket, request: Request, key: string, input: VerifiedImageUpload): Promise<R2Object> {
  const declaredLength = parseContentLength(request.headers.get('Content-Length') ?? undefined);
  if (declaredLength !== undefined && declaredLength !== input.byteSize) {
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }
  const body = request.body as unknown as ReadableStream<Uint8Array> | null;
  if (!body) throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  const [inspection, stream] = body.tee();
  const reader = inspection.getReader();
  const prefix = new Uint8Array(12);
  let count = 0;
  try {
    while (count < prefix.length) {
      const next = await reader.read();
      if (next.done) break;
      const copied = Math.min(next.value.byteLength, prefix.length - count);
      prefix.set(next.value.subarray(0, copied), count);
      count += copied;
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    void stream.cancel().catch(() => {});
    throw error;
  }
  void reader.cancel().catch(() => {});
  if (sniffEncodedMime(prefix.subarray(0, count)) !== input.contentType) {
    await stream.cancel();
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }
  let stored: R2Object | null;
  try {
    stored = await bucket.put(key, stream.pipeThrough(new FixedLengthStream(input.byteSize)), {
      customMetadata: { checksumSha256: input.checksumSha256 },
      httpMetadata: { contentType: input.contentType },
      sha256: input.checksumSha256,
    });
  } catch (error) {
    if (isR2ChecksumMismatch(error)) throw new ApiException('VARIANT_CHECKSUM_MISMATCH', 'errors.variantChecksumMismatch', 422, { cause: error });
    throw error;
  }
  if (!stored || stored.size !== input.byteSize) {
    if (stored) await bucket.delete(key);
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }
  return stored;
}
