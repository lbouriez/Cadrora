import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createEventGrantToken, EVENT_GRANT_COOKIE, eventGrantCookie, eventGrantCookieName } from '../../../src/server/auth/eventGrant';
import { authContext } from '../../../src/server/middleware/authContext';
import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerMediaRoutes } from '../../../src/server/routes/media';
import { registerPublicRoutes } from '../../../src/server/routes/public';
import type { EventRow } from '../../../src/server/routes/public/data';
import type { AppEnv } from '../../../src/server/types';

const secret = '0123456789abcdef0123456789abcdef';

function fixture() {
  const versions: Record<string, number> = { first: 1, second: 2 };
  const event = (id: string): EventRow => ({
    id, slug: `${id}-slug`, title: id, description: null, starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC',
    cover_photo_id: null, visibility: 'published', access: 'protected', allow_downloads: 0, show_photo_metadata: 0,
    retouch_selection_enabled: 0, show_on_gallery_page: 0, face_search_enabled: 0, nearby_search_enabled: 0,
    keep_originals: 0, retention_days: null, offline_at: null, deleting_at: null, revision: 1,
    created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
  });
  const database = { prepare: (sql: string) => ({ bind: (id: string) => ({ first: () => {
    const canonical = id.replace(/-slug$/u, '');
    if (!(canonical in versions)) return Promise.resolve(null);
    return Promise.resolve(sql.includes('event_credentials') ? { access_version: versions[canonical] } : event(canonical));
  } }) }) } as unknown as D1Database;
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', authContext);
  app.use('*', cacheHeaders);
  registerPublicRoutes(app);
  const get = vi.fn(() => Promise.resolve({ body: new Response('photo').body!, contentLength: 5, contentType: 'image/jpeg', etag: 'etag' }));
  registerMediaRoutes(app, {
    repository: () => ({ findPublishedVariant: ({ eventId }) => Promise.resolve({
      access: 'protected', accessVersion: versions[eventId] ?? 1, allowDownloads: false, keepOriginals: false,
      byteSize: 5, contentType: 'image/jpeg', filename: 'photo.jpg', storageKey: `private/${eventId}`,
    }) }),
    storage: () => ({ get, deleteMany: vi.fn() }),
  });
  const request = (path: string, cookie: string) => app.request(path, { headers: { Cookie: cookie } }, { DB: database, AUTH_PEPPER: secret });
  return { request, versions, get };
}

async function cookieFor(eventId: string, accessVersion: number, now?: Date) {
  return (await eventGrantCookie({ eventId, accessVersion }, secret, '8', now)).split(';')[0] ?? '';
}

describe('concurrent private galleries', () => {
  it('opens both slug API routes and media while independently enforcing password rotation', async () => {
    const { request, versions, get } = fixture();
    const cookie = `${await cookieFor('first', 1)}; ${await cookieFor('second', 2)}`;
    for (const id of ['first', 'second']) {
      const gallery = await request(`/api/v1/galleries/${id}-slug`, cookie);
      const media = await request(`/media/${id}/photo/1/thumb`, cookie);
      expect(gallery.status).toBe(200);
      expect(gallery.headers.get('Cache-Control')).toBe('private, no-store');
      expect(media.status).toBe(200);
      expect(media.headers.get('Cache-Control')).toBe('private, max-age=3600');
    }
    versions.first = 3;
    get.mockClear();
    expect((await request('/api/v1/galleries/first-slug', cookie)).status).toBe(401);
    expect((await request('/media/first/photo/1/thumb', cookie)).status).toBe(403);
    expect(get).not.toHaveBeenCalled();
    expect((await request('/api/v1/galleries/second-slug', cookie)).status).toBe(200);
    expect((await request('/media/second/photo/1/thumb', cookie)).status).toBe(200);
  });

  it('retains a legacy gallery while another gallery uses a scoped cookie', async () => {
    const { request } = fixture();
    const token = await createEventGrantToken({ eventId: 'first', accessVersion: 1 }, secret, '8');
    const cookie = `${EVENT_GRANT_COOKIE}=${token}; ${await cookieFor('second', 2)}`;
    expect((await request('/api/v1/galleries/first-slug', cookie)).status).toBe(200);
    expect((await request('/api/v1/galleries/second-slug', cookie)).status).toBe(200);
    expect((await request('/media/first/photo/1/thumb', cookie)).status).toBe(200);
  });

  it('rejects expired, forged and wrong-gallery scoped tokens without reviving a legacy grant', async () => {
    const { request, get } = fixture();
    const valid = await createEventGrantToken({ eventId: 'first', accessVersion: 1 }, secret, '8');
    const another = await createEventGrantToken({ eventId: 'second', accessVersion: 2 }, secret, '8');
    const expired = await cookieFor('first', 1, new Date('2000-01-01T00:00:00.000Z'));
    const legacy = `${EVENT_GRANT_COOKIE}=${valid}`;
    for (const scoped of [expired, `${eventGrantCookieName('first')}=malformed`,
      `${eventGrantCookieName('first')}=invalid.signature`, `${eventGrantCookieName('first')}=${another}`]) {
      const cookie = `${legacy}; ${scoped}; ${await cookieFor('second', 2)}`;
      expect((await request('/api/v1/galleries/first-slug', cookie)).status).toBe(401);
      expect((await request('/media/first/photo/1/thumb', cookie)).status).toBe(403);
      expect((await request('/api/v1/galleries/second-slug', cookie)).status).toBe(200);
    }
    expect(get).not.toHaveBeenCalled();
  });
});
