import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { authContext } from '../../../src/server/middleware/authContext';
import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { MediaRecord, MediaRepository } from '../../../src/server/repositories/mediaRepository';
import { registerMediaRoutes } from '../../../src/server/routes/media';
import type { StorageService } from '../../../src/server/services/storage';
import type { AppEnv } from '../../../src/server/types';

const publicMedia: MediaRecord = {
  access: 'public',
  accessVersion: null,
  allowDownloads: true,
  keepOriginals: false,
  byteSize: 5,
  contentType: 'image/jpeg',
  filename: 'photo.jpg',
  storageKey: 'events/e/photos/p/1/thumb.jpg',
};

function createApp(media: MediaRecord | null, storage: StorageService, grant = false, cache?: (media: MediaRecord) => Promise<Response | null>) {
  const repository: MediaRepository = { findPublishedVariant: vi.fn().mockResolvedValue(media) };
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', authContext);
  if (grant) {
    app.use('*', async (context, next) => {
      context.set('auth', { eventGrant: { accessVersion: 3, eventId: 'event-1' } });
      await next();
    });
  }
  app.use('*', cacheHeaders);
  registerMediaRoutes(app, { repository: () => repository, storage: () => storage,
    ...(cache ? { cache: (_context, _url, _eventId, record) => cache(record) } : {}) });
  return app;
}

describe('media route', () => {
  it('streams a D1-resolved public object with bounded browser caching', async () => {
    const get = vi.fn().mockResolvedValue({
      body: new Response('photo').body!,
      contentLength: 5,
      contentType: 'image/jpeg',
      etag: '"etag"',
    });
    const storage: StorageService = {
      deleteMany: vi.fn(),
      get,
    };
    const response = await createApp(publicMedia, storage).request(
      '/media/event-1/photo-1/1/thumb',
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('photo');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, must-revalidate');
    expect(response.headers.get('X-Cadrora-Media-Cache')).toBe('fallback');
    expect(get).toHaveBeenCalledWith(publicMedia.storageKey);
  });

  it('reads public display bytes from cache after the D1 lookup', async () => {
    const get = vi.fn();
    const cache = vi.fn().mockResolvedValue(new Response('cached-photo', { status: 200 }));
    const response = await createApp(publicMedia, { deleteMany: vi.fn(), get }, false, cache)
      .request('/media/event-1/photo-1/1/thumb');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('cached-photo');
    expect(response.headers.get('X-Cadrora-Media-Cache')).toBe('unknown');
    expect(cache).toHaveBeenCalledWith(publicMedia);
    expect(get).not.toHaveBeenCalled();
  });

  it('never reads cached bytes after a D1 transition to protected access', async () => {
    const cache = vi.fn().mockResolvedValue(new Response('stale-public-copy'));
    const get = vi.fn();
    const response = await createApp(
      { ...publicMedia, access: 'protected', accessVersion: 3 },
      { deleteMany: vi.fn(), get }, false, cache,
    ).request('/media/event-1/photo-1/1/thumb');
    expect(response.status).toBe(403);
    expect(cache).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects protected media before touching R2 when the grant is missing', async () => {
    const get = vi.fn();
    const storage: StorageService = { deleteMany: vi.fn(), get };
    const response = await createApp(
      { ...publicMedia, access: 'protected', accessVersion: 3 },
      storage,
    ).request('/media/event-1/photo-1/1/thumb');

    expect(response.status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it('allows the matching current event grant', async () => {
    const storage: StorageService = {
      deleteMany: vi.fn(),
      get: vi.fn().mockResolvedValue({
        body: new Response('photo').body!,
        contentLength: 5,
        contentType: 'image/jpeg',
        etag: '"etag"',
      }),
    };
    const response = await createApp(
      { ...publicMedia, access: 'protected', accessVersion: 3 },
      storage,
      true,
    ).request('/media/event-1/photo-1/1/thumb');

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it.each(['download', 'original'])('rejects a disabled %s variant before reading R2', async (variant) => {
    const get = vi.fn();
    const storage: StorageService = { deleteMany: vi.fn(), get };
    const response = await createApp({ ...publicMedia, allowDownloads: false }, storage).request(
      `/media/event-1/photo-1/1/${variant}`,
    );

    expect(response.status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it('serves an allowed download as an attachment with the encoded file extension', async () => {
    const storage: StorageService = {
      deleteMany: vi.fn(),
      get: vi.fn().mockResolvedValue({
        body: new Response('photo').body!,
        contentLength: 5,
        contentType: 'image/jpeg',
        etag: '"etag"',
      }),
    };
    const response = await createApp({ ...publicMedia, contentType: 'image/jpeg', filename: 'source.png' }, storage)
      .request('/media/event-1/photo-1/1/download');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="source.jpg"');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('serves an unchanged PNG original only while originals and downloads are enabled', async () => {
    const get = vi.fn().mockResolvedValue({
      body: new Response('original').body!, contentLength: 8, contentType: 'image/png', etag: '"etag"',
    });
    const storage: StorageService = { deleteMany: vi.fn(), get };
    const media = { ...publicMedia, contentType: 'image/png', keepOriginals: true };
    const allowed = await createApp(media, storage).request('/media/event-1/photo-1/1/original');
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('Content-Disposition')).toBe('attachment; filename="photo.png"');
    expect(allowed.headers.get('Cache-Control')).toBe('private, no-store');
    const denied = await createApp({ ...media, keepOriginals: false }, storage).request('/media/event-1/photo-1/1/original');
    expect(denied.status).toBe(403);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
