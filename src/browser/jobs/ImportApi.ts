import {
  FinalizePhotoResponseSchema,
  ImportCreateRequestSchema,
  ImportCreateResponseSchema,
  ImportDeclarePhotosRequestSchema,
  ImportDeclarePhotosResponseSchema,
  VariantUploadResponseSchema,
  type Import,
  type ImportCreateRequest,
  type ImportDeclarePhotosRequest,
  type PhotoDeclaration,
} from '../../shared/schemas';
import type { EncodedVariant } from '../images';

export interface ImportApi {
  createImport(eventId: string, request: ImportCreateRequest, signal?: AbortSignal): Promise<Import>;
  declarePhotos(importId: string, request: ImportDeclarePhotosRequest, signal?: AbortSignal): Promise<string[]>;
  finalizePhoto(photoId: string, signal?: AbortSignal): Promise<void>;
  uploadVariant(photoId: string, variant: EncodedVariant, signal?: AbortSignal): Promise<void>;
}

/** Typed browser client for the isolated PC Worker-route contract. */
export class FetchImportApi implements ImportApi {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

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
        ...(signal ? { signal } : {}),
      },
    );
    VariantUploadResponseSchema.parse(await this.json(response));
  }

  private async json(response: Response): Promise<unknown> {
    const value: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string'
          ? value.message
          : 'Import request failed.';
      throw new Error(message);
    }
    return value;
  }
}

export function declarationFromJournal(photo: {
  capturedAt?: string;
  contentType: PhotoDeclaration['contentType'];
  filename: string;
  height: number;
  id: string;
  sortKey: string;
  width: number;
}): PhotoDeclaration {
  return {
    ...(photo.capturedAt ? { capturedAt: photo.capturedAt } : {}),
    contentType: photo.contentType,
    filename: photo.filename,
    height: photo.height,
    id: photo.id,
    sortKey: photo.sortKey,
    width: photo.width,
  };
}
