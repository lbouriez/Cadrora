import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '../../../src/shared/schemas';
import { errorBoundary } from '../../../src/server/middleware';
import { registerAdminImportRoutes } from '../../../src/server/routes/admin/imports';
import type { AppEnv } from '../../../src/server/types';

describe('admin import routes', () => {
  it('fails closed before accessing D1 or R2 when no verified admin is present', async () => {
    const testApp = new Hono<AppEnv>();
    testApp.use('*', async (context, next) => {
      context.set('auth', {});
      context.set('requestId', 'import-route-test');
      await next();
    });
    testApp.onError(errorBoundary);
    registerAdminImportRoutes(testApp);

    const response = await testApp.request('/api/v1/admin/events/event-1/imports', {
      body: JSON.stringify({ id: 'import-1', totalPhotos: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(401);
    expect(body.code).toBe('ADMIN_AUTH_REQUIRED');
    expect(response.headers.get('Cache-Control')).toBeNull();
  });

  it('streams a MIME-checked upload to its derived R2 key with R2 SHA-256 validation', async () => {
    const media = jpegBytes();
    const checksum = 'a'.repeat(64);
    const database = variantDatabase();
    const put = vi.fn(async (_key: string, body: ReadableStream<Uint8Array>, options: R2PutOptions) => {
      expect(body).toBeInstanceOf(ReadableStream);
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
  insertedVariant: boolean;
}

function variantDatabase(): VariantDatabase {
  const state = { insertedVariant: false, values: [] as unknown[], variantValues: [] as unknown[] };
  const database = {
    get insertedVariant() {
      return state.insertedVariant;
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
              content_type: 'image/jpeg',
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
              state: 'pending',
              updated_at: '2026-09-20T12:00:00.000Z',
              width: 1200,
            };
          }
          if (query.includes('FROM events WHERE id')) return { id: 'event-1' };
          if (query.includes('SELECT byte_size FROM photo_variants')) return null;
          if (query.includes('COALESCE(SUM(byte_size)')) return { value: 0 };
          if (query.includes('SELECT photo_id, variant, storage_key')) {
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
          return { success: true };
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
    MAX_EVENTS: '10',
    MAX_FACES_PER_EVENT: '100',
    MAX_PHOTOS_PER_EVENT: '100',
    MAX_STORAGE_BYTES: '1000000',
    MEDIA_BUCKET: bucket,
    MODELS_BUCKET: {} as R2Bucket,
    SESSION_TTL_H: '8',
    SITE_DEFAULT_LANG: 'fr',
  };
}
