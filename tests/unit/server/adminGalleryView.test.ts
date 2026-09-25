import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { readEventGrantToken, verifyEventGrantToken } from '../../../src/server/auth';
import { adminCsrf } from '../../../src/server/middleware/adminCsrf';
import { authContext } from '../../../src/server/middleware/authContext';
import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import type { MediaRecord, MediaRepository } from '../../../src/server/repositories/mediaRepository';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import { registerMediaRoutes } from '../../../src/server/routes/media';
import type { EventRow } from '../../../src/server/routes/public/data';
import { registerPublicRoutes } from '../../../src/server/routes/public';
import type { StorageService } from '../../../src/server/services/storage';
import type { AppEnv, AuthContext } from '../../../src/server/types';
import { AdminGalleryViewResponseSchema } from '../../../src/shared/schemas/gallery';

const secret = '0123456789abcdef0123456789abcdef';
const eventRow: EventRow = {
  id: 'gallery-1', slug: 'private-gallery', title: 'Private gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'protected', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0,
  retouch_selection_enabled: 1, show_on_gallery_page: 1, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

function galleryApp(auth: AuthContext, row: EventRow = eventRow, accessVersion: number | null = 7) {
  const prepare = vi.fn((query: string) => {
    const statement = {
      bind: () => statement,
      first: () => Promise.resolve(query.includes('FROM event_credentials')
        ? accessVersion === null ? null : { access_version: accessVersion }
        : row),
    };
    return statement;
  });
  const app = new Hono<AppEnv>();
  app.use('*', async (context, next) => {
    context.set('requestId', 'gallery-view-test');
    context.set('auth', auth);
    await next();
  });
  app.onError(errorBoundary);
  app.use('/api/v1/admin/*', adminCsrf);
  registerAdminEventRoutes(app);
  const bindings = { AUTH_PEPPER: secret, DB: { prepare } as unknown as D1Database, SESSION_TTL_H: '8' } as CloudflareBindings;
  return { app, bindings, prepare };
}

const owner: AuthContext = { admin: {
  access: 'manage', authMode: 'password', createdAt: eventRow.created_at,
  expiresAt: '2030-01-02T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
} };

function viewRequest(app: Hono<AppEnv>, bindings: CloudflareBindings, origin = 'http://localhost') {
  return app.request('/api/v1/admin/galleries/gallery-1/view', {
    headers: { Origin: origin }, method: 'POST',
  }, bindings);
}

describe('admin View Gallery access', () => {
  it('issues a current, gallery-scoped grant to an owner without reading its password', async () => {
    const { app, bindings, prepare } = galleryApp(owner);
    const response = await viewRequest(app, bindings);

    expect(response.status).toBe(200);
    expect(AdminGalleryViewResponseSchema.parse(await response.json())).toEqual({ slug: 'private-gallery' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
    const token = readEventGrantToken(cookie);
    expect(token).not.toBeNull();
    expect(await verifyEventGrantToken(token ?? '', secret)).toEqual({ eventId: 'gallery-1', accessVersion: 7 });
    expect(prepare.mock.calls.map(([query]) => query)).not.toContain('SELECT password_hash, access_version FROM event_credentials WHERE event_id = ?1');
  });

  it('opens the ordinary protected gallery and its media with the issued cookie', async () => {
    const { app, bindings } = galleryApp(owner);
    const issued = await viewRequest(app, bindings);
    const cookie = issued.headers.get('Set-Cookie')?.split(';')[0] ?? '';
    const media: MediaRecord = {
      access: 'protected', accessVersion: 7, allowDownloads: false, keepOriginals: false,
      byteSize: 5, contentType: 'image/jpeg', filename: 'photo.jpg', storageKey: 'private-photo',
    };
    const repository: MediaRepository = { findPublishedVariant: vi.fn().mockResolvedValue(media) };
    const storage: StorageService = {
      deleteMany: vi.fn(),
      get: vi.fn().mockResolvedValue({
        body: new Response('photo').body!, contentLength: 5, contentType: 'image/jpeg', etag: 'etag',
      }),
    };
    const viewer = new Hono<AppEnv>();
    viewer.use('*', async (context, next) => { context.set('requestId', 'gallery-view-test'); await next(); });
    viewer.onError(errorBoundary);
    viewer.use('*', authContext);
    viewer.use('*', cacheHeaders);
    registerPublicRoutes(viewer);
    registerMediaRoutes(viewer, { repository: () => repository, storage: () => storage });
    const viewerBindings = { ...bindings, ADMIN_AUTH_MODE: 'password' as const };

    const gallery = await viewer.request('/api/v1/galleries/gallery-1', { headers: { Cookie: cookie } }, viewerBindings);
    const photo = await viewer.request('/media/gallery-1/photo-1/1/thumb', { headers: { Cookie: cookie } }, viewerBindings);
    const locked = await viewer.request('/api/v1/galleries/gallery-1', {}, viewerBindings);

    expect(gallery.status).toBe(200);
    expect(gallery.headers.get('Cache-Control')).toBe('private, no-store');
    expect(photo.status).toBe(200);
    expect(photo.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(await photo.text()).toBe('photo');
    expect(locked.status).toBe(401);
  });

  const deniedSessions: [string, AuthContext][] = [
    ['missing owner', {}],
    ['read-only demo', { admin: { ...owner.admin!, access: 'read-only' as const } }],
  ];
  it.each(deniedSessions)('does not issue a grant for %s', async (_label, auth) => {
    const { app, bindings, prepare } = galleryApp(auth);
    const response = await viewRequest(app, bindings);
    expect(response.status).toBe(auth.admin ? 403 : 401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin POST before issuing a grant', async () => {
    const { app, bindings, prepare } = galleryApp(owner);
    const response = await viewRequest(app, bindings, 'https://example.org');
    expect(response.status).toBe(403);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });

  const unavailableRows: [string, EventRow][] = [
    ['draft', { ...eventRow, visibility: 'draft' }],
    ['offline', { ...eventRow, offline_at: '2030-01-01T01:00:00.000Z' }],
    ['deleting', { ...eventRow, deleting_at: '2030-01-01T01:00:00.000Z' }],
  ];
  it.each(unavailableRows)('keeps a %s gallery unavailable', async (_label, row) => {
    const { app, bindings } = galleryApp(owner, row);
    const response = await viewRequest(app, bindings);
    expect(response.status).toBe(404);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('fails closed when the protected gallery has no credential version', async () => {
    const { app, bindings } = galleryApp(owner, eventRow, null);
    const response = await viewRequest(app, bindings);
    expect(response.status).toBe(503);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('fails closed when grant signing is not configured', async () => {
    const { app, bindings } = galleryApp(owner);
    const missingSecret = { ...bindings };
    delete missingSecret.AUTH_PEPPER;
    const response = await viewRequest(app, missingSecret);
    expect(response.status).toBe(503);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});
