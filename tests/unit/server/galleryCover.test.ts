import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import { toPublicEvent } from '../../../src/server/routes/public/data';
import type { AppEnv } from '../../../src/server/types';
import type { Event } from '../../../src/shared/schemas/event';

const eventRow = {
  id: 'event-1', slug: 'wedding', title: 'Wedding', description: null,
  starts_at: '2026-09-20T12:00:00.000Z', timezone: 'UTC', cover_photo_id: 'photo-1',
  visibility: 'published', access: 'public', allow_downloads: 1,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 2,
  created_at: '2026-09-20T12:00:00.000Z', updated_at: '2026-09-20T12:00:00.000Z',
};

function appWithCover(authorized: boolean) {
  const app = new Hono<AppEnv>();
  app.use('*', async (context, next) => {
    context.set('requestId', 'cover-test');
    context.set('auth', authorized ? { admin: {
      access: 'manage', authMode: 'password', createdAt: eventRow.created_at,
      expiresAt: '2030-01-01T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
    } } : {});
    await next();
  });
  app.onError(errorBoundary);
  registerAdminEventRoutes(app);
  return app;
}

function bindings() {
  const get = vi.fn().mockResolvedValue({ body: new Response('thumb').body! });
  const db = { prepare: (sql: string) => ({
    bind: (...values: unknown[]) => ({
      first: () => Promise.resolve(sql.includes('SELECT * FROM events') ? eventRow :
        sql.includes('SELECT v.storage_key') && values[0] === 'event-1' && values[1] === 'photo-1'
          ? { storage_key: 'events/event-1/photos/photo-1/0/thumb.webp', content_type: 'image/webp' }
          : null),
      all: () => Promise.resolve({ results: sql.includes('JOIN photo_variants') ? [{ id: 'photo-1', filename: 'portrait.webp' }] : [] }),
    }),
  }) } as unknown as D1Database;
  return { DB: db, MEDIA_BUCKET: { get } as unknown as R2Bucket, get };
}

describe('gallery cover', () => {
  it('derives a public cover URL only when a published revision is available', () => {
    const event = {
      id: 'event-1', coverPhotoId: 'photo-1',
    } as Event;
    expect(toPublicEvent(event, 7).coverPhotoUrl).toBe('/media/event-1/photo-1/7/medium');
    expect(toPublicEvent(event).coverPhotoUrl).toBeNull();
  });

  it('keeps cover candidates and their R2 thumbnails behind admin authentication', async () => {
    const resources = bindings();
    const env = { DB: resources.DB, MEDIA_BUCKET: resources.MEDIA_BUCKET } as CloudflareBindings;
    const denied = await appWithCover(false).request('/api/v1/admin/galleries/event-1/cover-photos', {}, env);
    expect(denied.status).toBe(401);
    expect(resources.get).not.toHaveBeenCalled();

    const app = appWithCover(true);
    const list = await app.request('/api/v1/admin/galleries/event-1/cover-photos', {}, env);
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ photos: [{ id: 'photo-1', filename: 'portrait.webp' }] });
    const thumbnail = await app.request('/api/v1/admin/galleries/event-1/cover-photos/photo-1', {}, env);
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.headers.get('Cache-Control')).toBe('no-store');
    expect(await thumbnail.text()).toBe('thumb');
    const wrongGallery = await app.request('/api/v1/admin/galleries/event-1/cover-photos/photo-other', {}, env);
    expect(wrongGallery.status).toBe(404);
    expect(resources.get).toHaveBeenCalledTimes(1);
  });
});
