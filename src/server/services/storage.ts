export interface StoredMediaObject {
  body: ReadableStream;
  contentLength: number;
  contentType: string;
  etag: string;
}

export interface StorageService {
  deleteMany(keys: string[]): Promise<void>;
  get(key: string): Promise<StoredMediaObject | null>;
}

export class R2StorageService implements StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string): Promise<StoredMediaObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    return {
      body: object.body,
      contentLength: object.size,
      contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: object.httpEtag,
    };
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    for (let offset = 0; offset < keys.length; offset += 1_000) {
      await this.bucket.delete(keys.slice(offset, offset + 1_000));
    }
  }
}

