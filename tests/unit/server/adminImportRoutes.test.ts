import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema, ImportRecoveryResponseSchema } from '../../../src/shared/schemas';
import { errorBoundary } from '../../../src/server/middleware';
import { registerAdminImportRoutes } from '../../../src/server/routes/admin/imports';
import type { AppEnv } from '../../../src/server/types';

const fixedLengthBodies = new WeakMap<ReadableStream<Uint8Array>, number>();

describe('admin import routes', () => {
  beforeEach(() => {
    // Node's generic streams lack R2's known-length marker. Model the Worker
    // primitive so the fake bucket can reject a plain ReadableStream.
    vi.stubGlobal('FixedLengthStream', class extends TransformStream<Uint8Array, Uint8Array> {
      constructor(length: number) {
        super();
        fixedLengthBodies.set(this.readable, length);
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed before accessing D1 or R2 when no verified admin is present', async () => {
    const testApp = new Hono<AppEnv>();
    testApp.use('*', async (context, next) => {
      context.set('auth', {});
      context.set('requestId', 'import-route-test');
      await next();
    });
    testApp.onError(errorBoundary);
    registerAdminImportRoutes(testApp);

    const response = await testApp.request('/api/v1/admin/galleries/event-1/imports', {
      body: JSON.stringify({ id: 'import-1', totalPhotos: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(401);
    expect(body.code).toBe('ADMIN_AUTH_REQUIRED');
    expect(response.headers.get('Cache-Control')).toBeNull();

    const recovery = await testApp.request('/api/v1/admin/galleries/event-1/import-recovery');
    expect(recovery.status).toBe(401);
    expect(ApiErrorSchema.parse(await recovery.json()).code).toBe('ADMIN_AUTH_REQUIRED');
  });

  it('returns only future-import hashes already present in the selected gallery', async () => {
    const hash = 'b'.repeat(64);
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({
        first: () => Promise.resolve(query.includes('FROM events') ? { id: 'event-1' } : null),
        all: () => {
          expect(query).toContain('source_sha256');
          expect(values).toEqual(['event-1', hash]);
          return Promise.resolve({ results: [{ source_sha256: hash }] });
        },
      }),
    }));
    const database = { prepare } as unknown as D1Database;
    const response = await authorizedApp().request('/api/v1/admin/galleries/event-1/photo-duplicates', {
      body: JSON.stringify({ hashes: [hash] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }, bindings(database, {} as R2Bucket));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ existingHashes: [hash] });
  });

  it('lists only missing variants for an authorized unfinished import', async () => {
    const hash = 'c'.repeat(64);
    const prepare = vi.fn((query: string) => ({
      bind: (...values: unknown[]) => ({
        first: () => Promise.resolve(query.includes('FROM events') ? { id: 'event-1' } : null),
        all: () => {
          expect(query).toContain("p.state = 'pending'");
          expect(query).toContain('i.replacement_photo_id IS NULL');
          expect(values).toEqual(['event-1']);
          return Promise.resolve({ results: ['thumb', 'small', 'medium'].map((variant) => ({
            id: 'photo-1', filename: 'original.jpg', source_sha256: hash, keep_originals: 0, variant,
          })) });
        },
      }),
    }));
    const database = { prepare } as unknown as D1Database;
    const response = await authorizedApp().request('/api/v1/admin/galleries/event-1/import-recovery', {},
      bindings(database, {} as R2Bucket));

    expect(response.status).toBe(200);
    expect(ImportRecoveryResponseSchema.parse(await response.json())).toEqual({ photos: [{
      id: 'photo-1', filename: 'original.jpg', sourceSha256: hash,
      keepOriginals: false, missingVariants: ['large', 'download'],
    }] });
  });

  it.each([100, 120])('refuses a new import before creating any D1 row when %i bytes meet or exceed the owner storage limit', async (usedBytes) => {
    const insert = vi.fn();
    const database = {
      prepare(query: string) {
        const statement = {
          bind: () => statement,
          first: () => Promise.resolve(query.includes('FROM site_settings')
            ? { owner_face_limit: null, owner_storage_limit_bytes: 100 }
            : query.includes("FROM usage_counters WHERE key = 'storage_bytes'") ? { value: usedBytes }
              : query.includes('SELECT id, keep_originals, access FROM events') ? { id: 'event-1', keep_originals: 0, access: 'public' }
                : query.includes('COUNT(*)') ? { value: 0 } : null),
          run: insert,
        };
        return statement;
      },
    } as unknown as D1Database;
    const put = vi.fn();
    const bucket = { put } as unknown as R2Bucket;
    const response = await authorizedApp().request('/api/v1/admin/galleries/event-1/imports', {
      body: JSON.stringify({ id: 'import-new', totalPhotos: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }, bindings(database, bucket));

    expect(response.status).toBe(413);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(insert).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects a resumed import and new photo declaration when storage is full without mutating D1', async () => {
    const batch = vi.fn();
    const run = vi.fn();
    const importRow = {
      id: 'import-existing', event_id: 'event-1', state: 'processing', total_photos: 1,
      completed_photos: 0, created_at: '2026-09-25T00:00:00.000Z', updated_at: '2026-09-25T00:00:00.000Z',
    };
    const database = {
      batch,
      prepare(query: string) {
        const statement = {
          bind: () => statement,
          all: () => Promise.resolve({ results: [] }),
          first: () => Promise.resolve(query.includes('FROM site_settings')
            ? { owner_face_limit: null, owner_storage_limit_bytes: 100 }
            : query.includes("FROM usage_counters WHERE key = 'storage_bytes'") ? { value: 100 }
              : query.includes('FROM imports WHERE id') && query.includes('completed_photos') ? importRow
                : query.includes('SELECT keep_originals FROM imports') ? { keep_originals: 0 }
                  : query.includes('SELECT replacement_photo_id FROM imports') ? { replacement_photo_id: null }
                    : query.includes('FROM events') ? { id: 'event-1' }
                      : query.includes('COUNT(*)') ? { value: 0 } : null),
          run,
        };
        return statement;
      },
    } as unknown as D1Database;
    const app = authorizedApp();
    const env = bindings(database, {} as R2Bucket);
    const resumed = await app.request('/api/v1/admin/galleries/event-1/imports', {
      body: JSON.stringify({ id: 'import-existing', totalPhotos: 1 }),
      headers: { 'Content-Type': 'application/json' }, method: 'POST',
    }, env);
    const declared = await app.request('/api/v1/admin/imports/import-existing/photos', {
      body: JSON.stringify({ chunkNumber: 0, photos: [{
        contentType: 'image/jpeg', filename: 'photo.jpg', height: 100,
        id: 'photo-new', sortKey: '0', width: 100,
      }] }),
      headers: { 'Content-Type': 'application/json' }, method: 'POST',
    }, env);

    expect(resumed.status).toBe(413);
    expect(ApiErrorSchema.parse(await resumed.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(declared.status).toBe(413);
    expect(ApiErrorSchema.parse(await declared.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(batch).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it.each([1_000_000, 1_000_100])('rejects a new variant at %i stored bytes before touching R2', async (usedBytes) => {
    const database = variantDatabase('image/jpeg', false, usedBytes);
    const put = vi.fn();
    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/thumb', {
      body: jpegBytes(), headers: variantHeaders(jpegBytes().byteLength, 'a'.repeat(64)), method: 'PUT',
    }, bindings(database, { put } as unknown as R2Bucket));

    expect(response.status).toBe(413);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(put).not.toHaveBeenCalled();
    expect(database.insertedVariant).toBe(false);
  });

  it('streams a MIME-checked upload to its derived R2 key with R2 SHA-256 validation', async () => {
    const media = jpegBytes();
    const checksum = 'a'.repeat(64);
    const database = variantDatabase();
    const put = vi.fn(async (_key: string, body: ReadableStream<Uint8Array>, options: R2PutOptions) => {
      expect(body).toBeInstanceOf(ReadableStream);
      expect(fixedLengthBodies.get(body)).toBe(media.byteLength);
      expect(options.sha256).toBe(checksum);
      const received = new Uint8Array(await new Response(body).arrayBuffer());
      expect(received).toEqual(media);
      return { size: received.byteLength } as unknown as R2Object;
    });
    const bucket = { delete: vi.fn(), put } as unknown as R2Bucket;

    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/thumb', {
      body: media,
      headers: variantHeaders(media.byteLength, checksum),
      method: 'PUT',
    }, bindings(database, bucket));

    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledWith(
      'events/event-1/photos/photo-1/0/thumb.jpg',
      expect.any(ReadableStream),
      expect.objectContaining({
        customMetadata: { checksumSha256: checksum },
        httpMetadata: { contentType: 'image/jpeg' },
        sha256: checksum,
      }),
    );
    expect(database.insertedVariant).toBe(true);
  });

  it('streams a multi-chunk download-sized photo without changing its bytes', async () => {
    const media = new Uint8Array(1_724_741);
    media.set([0xff, 0xd8, 0xff], 0);
    media.set([0xff, 0xd9], media.length - 2);
    const database = variantDatabase();
    const put = vi.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
      expect(fixedLengthBodies.get(body)).toBe(media.length);
      expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(media);
      return { size: media.length } as unknown as R2Object;
    });
    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/download', {
      body: media, headers: variantHeaders(media.length, 'a'.repeat(64)), method: 'PUT',
    }, { ...bindings(database, { delete: vi.fn(), put } as unknown as R2Bucket), MAX_STORAGE_BYTES: '5000000' });

    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
    expect(database.insertedVariant).toBe(true);
  }, 15_000);

  it('deletes a streamed object and leaves D1 unchanged when its completed size differs from the declaration', async () => {
    const media = jpegBytes();
    const database = variantDatabase();
    const remove = vi.fn();
    const bucket = {
      delete: remove,
      put: vi.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
        await new Response(body).arrayBuffer();
        return { size: media.byteLength - 1 } as unknown as R2Object;
      }),
    } as unknown as R2Bucket;

    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/thumb', {
      body: media,
      headers: variantHeaders(media.byteLength, 'b'.repeat(64)),
      method: 'PUT',
    }, bindings(database, bucket));
    const error = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(422);
    expect(error.code).toBe('INVALID_VARIANT_MEDIA');
    expect(remove).toHaveBeenCalledWith('events/event-1/photos/photo-1/0/thumb.jpg');
    expect(database.insertedVariant).toBe(false);
  });

  it('preserves the checksum mismatch API contract when R2 rejects the streamed digest', async () => {
    const database = variantDatabase();
    const mismatch = Object.assign(new Error('BadDigest'), { code: 10037 });
    const bucket = { delete: vi.fn(), put: vi.fn().mockRejectedValue(mismatch) } as unknown as R2Bucket;

    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/thumb', {
      body: jpegBytes(),
      headers: variantHeaders(jpegBytes().byteLength, 'c'.repeat(64)),
      method: 'PUT',
    }, bindings(database, bucket));
    const error = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(422);
    expect(error.code).toBe('VARIANT_CHECKSUM_MISMATCH');
    expect(database.insertedVariant).toBe(false);
  });

  it('stores an unchanged PNG original only for an import that opted in', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const checksum = 'd'.repeat(64);
    const database = variantDatabase('image/png', true);
    const put = vi.fn(async (_key: string, body: ReadableStream<Uint8Array>) => {
      expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(bytes);
      return { size: bytes.length } as unknown as R2Object;
    });
    const response = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/original', {
      body: bytes,
      headers: { ...variantHeaders(bytes.length, checksum), 'Content-Type': 'image/png', 'X-Cadrora-Width': '1200', 'X-Cadrora-Height': '800' },
      method: 'PUT',
    }, bindings(database, { delete: vi.fn(), put } as unknown as R2Bucket));
    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledWith('events/event-1/photos/photo-1/0/original.png', expect.any(ReadableStream), expect.objectContaining({ httpMetadata: { contentType: 'image/png' } }));
    expect(database.insertedVariant).toBe(true);

    const denied = await authorizedApp().request('/api/v1/admin/photos/photo-1/variants/original', {
      body: bytes,
      headers: { ...variantHeaders(bytes.length, checksum), 'Content-Type': 'image/png', 'X-Cadrora-Width': '1200', 'X-Cadrora-Height': '800' },
      method: 'PUT',
    }, bindings(variantDatabase('image/png', false), { delete: vi.fn(), put } as unknown as R2Bucket));
    expect(denied.status).toBe(422);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('cancels a server import and refuses subsequent media uploads', async () => {
    const database = variantDatabase('image/jpeg', true);
    const put = vi.fn();
    const bucket = { delete: vi.fn(), put } as unknown as R2Bucket;
    const app = authorizedApp();
    const cancelled = await app.request('/api/v1/admin/imports/import-1/cancel', { method: 'POST' }, bindings(database, bucket));
    expect(cancelled.status).toBe(200);
    await expect(cancelled.json()).resolves.toMatchObject({ import: { state: 'cancelled' } });
    expect(database.photoState).toBe('deleting');
    expect(database.cleanupQueued).toBe(true);
    const upload = await app.request('/api/v1/admin/photos/photo-1/variants/original', {
      body: jpegBytes(), headers: variantHeaders(jpegBytes().byteLength, 'f'.repeat(64)), method: 'PUT',
    }, bindings(database, bucket));
    expect(upload.status).toBe(404);
    const finalize = await app.request('/api/v1/admin/photos/photo-1/finalize', {
      body: '{}', headers: { 'Content-Type': 'application/json' }, method: 'POST',
    }, bindings(database, bucket));
    expect(finalize.status).toBe(404);
    expect(put).not.toHaveBeenCalled();
  });
});

function authorizedApp(): Hono<AppEnv> {
  const testApp = new Hono<AppEnv>();
  testApp.use('*', async (context, next) => {
    context.set('auth', {
      admin: {
        access: 'manage',
        authMode: 'password',
        createdAt: '2026-09-20T12:00:00.000Z',
        expiresAt: '2026-09-20T20:00:00.000Z',
        id: 'session-1',
        revokedAt: null,
        subject: 'admin',
      },
    });
    context.set('requestId', 'import-route-test');
    await next();
  });
  testApp.onError(errorBoundary);
  registerAdminImportRoutes(testApp);
  return testApp;
}

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
}

function variantHeaders(byteSize: number, checksum: string): Record<string, string> {
  return {
    'Content-Type': 'image/jpeg',
    'X-Cadrora-Byte-Size': String(byteSize),
    'X-Cadrora-Checksum-Sha256': checksum,
    'X-Cadrora-Height': '320',
    'X-Cadrora-Width': '480',
  };
}

interface VariantDatabase extends D1Database {
  cleanupQueued: boolean;
  insertedVariant: boolean;
  photoState: string;
}

function variantDatabase(sourceType: 'image/jpeg' | 'image/png' = 'image/jpeg', keepOriginals = false, usedBytes = 0): VariantDatabase {
  const state = { cleanupQueued: false, importState: 'processing', insertedVariant: false, photoState: 'pending', values: [] as unknown[], variantValues: [] as unknown[] };
  const database = {
    get cleanupQueued() {
      return state.cleanupQueued;
    },
    get insertedVariant() {
      return state.insertedVariant;
    },
    get photoState() {
      return state.photoState;
    },
    async batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
    prepare(query: string) {
      const statement = {
        bind(...values: unknown[]) {
          state.values = values;
          return statement;
        },
        async first() {
          await Promise.resolve();
          if (query.includes('FROM photos WHERE id')) {
            return {
              captured_at: null,
              content_type: sourceType,
              created_at: '2026-09-20T12:00:00.000Z',
              event_id: 'event-1',
              face_state: 'disabled',
              filename: 'photo.jpg',
              height: 800,
              id: 'photo-1',
              import_id: 'import-1',
              moment_id: null,
              revision: 0,
              sort_key: '001',
              state: state.photoState,
              updated_at: '2026-09-20T12:00:00.000Z',
              width: 1200,
            };
          }
          if (query.includes('FROM events WHERE id')) return { id: 'event-1' };
          if (query.includes('FROM imports WHERE id') && query.includes('completed_photos')) return {
            id: 'import-1', event_id: 'event-1', state: state.importState, total_photos: 1, completed_photos: 0,
            created_at: '2026-09-20T12:00:00.000Z', updated_at: '2026-09-20T12:00:00.000Z',
          };
          if (query.includes('SELECT keep_originals FROM imports')) return { keep_originals: Number(keepOriginals) };
          if (query.includes('FROM site_settings')) {
            return {
              owner_face_limit: null,
              owner_storage_limit_bytes: null,
            };
          }
          if (query.includes('SELECT byte_size FROM photo_variants')) return null;
          if (query.includes("FROM usage_counters WHERE key = 'storage_bytes'")) return { value: usedBytes };
          if (query.includes('SELECT photo_id, variant, storage_key')) {
            if (!state.insertedVariant) return null;
            return {
              byte_size: state.variantValues[4],
              checksum_sha256: state.variantValues[7],
              content_type: state.variantValues[3],
              created_at: state.variantValues[8],
              height: state.variantValues[6],
              photo_id: state.variantValues[0],
              storage_key: state.variantValues[2],
              variant: state.variantValues[1],
              width: state.variantValues[5],
            };
          }
          return null;
        },
        async run() {
          await Promise.resolve();
          if (query.includes('INSERT INTO photo_variants')) {
            state.insertedVariant = true;
            state.variantValues = [...state.values];
          }
          if (query.includes("UPDATE imports SET state = 'cancelled'")) state.importState = 'cancelled';
          if (query.includes("UPDATE photos SET state = 'deleting'")) state.photoState = 'deleting';
          if (query.includes('INSERT OR IGNORE INTO maintenance_jobs')) state.cleanupQueued = true;
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  return database as unknown as VariantDatabase;
}

function bindings(database: D1Database, bucket: R2Bucket): CloudflareBindings {
  return {
    ADMIN_AUTH_MODE: 'password',
    ASSETS: {} as Fetcher,
    DB: database,
    MAX_FACES_PER_EVENT: '100',
    MAX_TOTAL_FACES: '1000',
    MAX_PHOTOS_PER_EVENT: '100',
    MAX_STORAGE_BYTES: '1000000',
    MEDIA_BUCKET: bucket,
    MODELS_BUCKET: {} as R2Bucket,
    SESSION_TTL_H: '8',
    SITE_DEFAULT_LANG: 'fr',
  };
}
