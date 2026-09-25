import {
  FinalizePhotoResponseSchema,
  ImportCreateRequestSchema,
  ImportCreateResponseSchema,
  ImportDeclarePhotosRequestSchema,
  ImportDeclarePhotosResponseSchema,
  PhotoDuplicateCheckRequestSchema,
  PhotoDuplicateCheckResponseSchema,
  VariantUploadResponseSchema,
  type Import,
  type ImportCreateRequest,
  type ImportDeclarePhotosRequest,
  type PhotoDeclaration,
} from '../../shared/schemas';
import { ApiErrorSchema } from '../../shared/schemas/apiError';
import type { EncodedVariant } from '../images';

export interface ImportApi {
  checkDuplicates(eventId: string, hashes: string[]): Promise<string[]>;
  cancelImport(importId: string): Promise<void>;
  createImport(eventId: string, request: ImportCreateRequest, signal?: AbortSignal): Promise<Import>;
  declarePhotos(importId: string, request: ImportDeclarePhotosRequest, signal?: AbortSignal): Promise<string[]>;
  finalizePhoto(photoId: string, signal?: AbortSignal): Promise<void>;
  uploadVariant(photoId: string, variant: EncodedVariant, signal?: AbortSignal): Promise<void>;
}

export class ImportRequestError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
    this.name = 'ImportRequestError';
  }
}

/** Typed browser client for the isolated PC Worker-route contract. */
export class FetchImportApi implements ImportApi {
  // Keep the native fetch invocation anchored to its browser global. Calling a
  // stored Window method as `this.fetcher(...)` can throw before any request is sent.
  constructor(private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)) {}

  async checkDuplicates(eventId: string, hashes: string[]): Promise<string[]> {
    const body = PhotoDuplicateCheckRequestSchema.parse({ hashes });
    const response = await this.fetcher(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/photo-duplicates`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return PhotoDuplicateCheckResponseSchema.parse(await this.json(response)).existingHashes;
  }

  async cancelImport(importId: string): Promise<void> {
    const response = await this.fetcher(`/api/v1/admin/imports/${encodeURIComponent(importId)}/cancel`, { method: 'POST' });
    ImportCreateResponseSchema.parse(await this.json(response));
  }

  async createImport(eventId: string, request: ImportCreateRequest, signal?: AbortSignal): Promise<Import> {
    const body = ImportCreateRequestSchema.parse(request);
    const response = await this.fetcher(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/imports`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    return ImportCreateResponseSchema.parse(await this.json(response)).import;
  }

  async declarePhotos(importId: string, request: ImportDeclarePhotosRequest, signal?: AbortSignal): Promise<string[]> {
    const body = ImportDeclarePhotosRequestSchema.parse(request);
    const response = await this.fetcher(`/api/v1/admin/imports/${encodeURIComponent(importId)}/photos`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    return ImportDeclarePhotosResponseSchema.parse(await this.json(response)).photoIds;
  }

  async finalizePhoto(photoId: string, signal?: AbortSignal): Promise<void> {
    const response = await this.fetcher(`/api/v1/admin/photos/${encodeURIComponent(photoId)}/finalize`, {
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    FinalizePhotoResponseSchema.parse(await this.json(response));
  }

  async uploadVariant(photoId: string, variant: EncodedVariant, signal?: AbortSignal): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError');
      const requestController = new AbortController();
      const onAbort = () => requestController.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; requestController.abort(); }, 90_000);
      try {
        // Blob bodies can be sent again; the Worker upserts this variant by photo ID and checksum.
        const response = await this.fetcher(
          `/api/v1/admin/photos/${encodeURIComponent(photoId)}/variants/${encodeURIComponent(variant.name)}`,
          {
            body: variant.blob,
            headers: {
              'Content-Type': variant.contentType,
              'X-Cadrora-Byte-Size': String(variant.byteSize),
              'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
              'X-Cadrora-Height': String(variant.height),
              'X-Cadrora-Width': String(variant.width),
            },
            method: 'PUT',
            signal: requestController.signal,
          },
        );
        VariantUploadResponseSchema.parse(await this.json(response));
        return;
      } catch (error) {
        const transientStatus = error instanceof ImportRequestError &&
          [429, 500, 502, 503, 504].includes(error.status) && error.code !== 'CONFIGURATION_INVALID';
        const transientNetwork = timedOut || error instanceof TypeError;
        if (attempt === 2 || signal?.aborted || (!transientStatus && !transientNetwork)) throw error;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        await waitForUploadRetry(400 * 3 ** attempt, signal);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    }
  }

  private async json(response: Response): Promise<unknown> {
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(value);
      throw new ImportRequestError(response.status, parsed.success ? parsed.data.code : undefined,
        parsed.success ? parsed.data.message : 'Import request failed.');
    }
    return value;
  }
}

function waitForUploadRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Upload cancelled.', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Upload cancelled.', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function declarationFromJournal(photo: {
  capturedAt?: string;
  contentType: PhotoDeclaration['contentType'];
  filename: string;
  height: number;
  id: string;
  sortKey: string;
  sourceSha256?: string;
  width: number;
}): PhotoDeclaration {
  return {
    ...(photo.capturedAt ? { capturedAt: photo.capturedAt } : {}),
    contentType: photo.contentType,
    filename: photo.filename,
    height: photo.height,
    id: photo.id,
    sortKey: photo.sortKey,
    ...(photo.sourceSha256 ? { sourceSha256: photo.sourceSha256 } : {}),
    width: photo.width,
  };
}
