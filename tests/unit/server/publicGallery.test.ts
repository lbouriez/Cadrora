import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { CACHE_CONTROL_BY_POLICY } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import {
  hashEventPassword,
  isShowcasePrivateEventPassword,
  verifyEventPassword,
  verifyEventPasswordDetailed,
} from '../../../src/server/routes/public/credentials';
import { verifyPassword } from '../../../src/server/auth';
import { photosFromRows } from '../../../src/server/routes/public/data';
import { createPublicEventRoutes, decodeGalleryCursor, decodePhotoCursor, encodeGalleryCursor, encodePhotoCursor } from '../../../src/server/routes/public/galleries';
import { D1MediaRepository } from '../../../src/server/repositories/mediaRepository';
import { PublicEventListSchema } from '../../../src/shared/schemas/gallery';
import type { AppEnv } from '../../../src/server/types';

describe('public gallery contracts', () => {
  const authPepper = 'test-auth-pepper-that-is-at-least-thirty-two-bytes';

  it('publishes protected event details without exposing a private cover or photo URL', async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{
        id: 'private-family', slug: 'family-afternoon', title: 'Family afternoon', description: 'A quiet celebration',
        starts_at: '2026-09-21T15:00:00.000Z', created_at: '2026-09-18T10:00:00.000Z',
        access: 'protected', service: 'family',
      }] }),
    };
    const prepare = vi.fn().mockReturnValue(statement);
    const app = new Hono<AppEnv>();
    app.route('/api/v1', createPublicEventRoutes());
    const response = await app.request('/api/v1/galleries', {}, {
      DB: { prepare } as unknown as D1Database,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [], protectedGalleries: [{
        id: 'private-family', slug: 'family-afternoon', title: 'Family afternoon', description: 'A quiet celebration',
        startsAt: '2026-09-21T15:00:00.000Z',
        createdAt: '2026-09-18T10:00:00.000Z',
        service: 'family',
      }], nextCursor: null,
    });
    expect(prepare.mock.calls[0]?.[0]).toContain("e.access = 'public' AND cover.id");
    expect(prepare.mock.calls[0]?.[0]).toContain('e.show_on_gallery_page = 1');
    expect(prepare.mock.calls[0]?.[0]).toContain('ORDER BY e.starts_at DESC, e.id ASC LIMIT ?4');
    expect(statement.bind).toHaveBeenCalledWith('all', null, null, 25);
  });

  it('round trips a stable sort key, id, and revision cursor', () => {
    const cursor = { sortKey: '2026-09-20T10:00:00.000Z', id: 'photo-2', revision: 7 };
    expect(decodePhotoCursor(encodePhotoCursor(cursor))).toEqual(cursor);
    expect(() => decodePhotoCursor('not-json')).toThrowError('errors.invalidCursor');
  });

  it('uses a bounded, shared cursor across public and protected gallery pages', async () => {
    const startsAt = '2026-09-20T10:00:00.000Z';
    const base = {
      description: null, service: null, starts_at: startsAt, timezone: 'America/Toronto',
      cover_photo_id: null, cover_revision: null, visibility: 'published',
      allow_downloads: 0, face_search_enabled: 0, nearby_search_enabled: 0,
      show_photo_metadata: 0, retouch_selection_enabled: 0, show_on_gallery_page: 1,
      keep_originals: 0, retention_days: null, offline_at: null, deleting_at: null,
      revision: 1, created_at: startsAt, updated_at: startsAt,
    };
    const rows = [
      { ...base, id: 'a', slug: 'first', title: 'First', access: 'public', service: 'wedding' },
      { ...base, id: 'b', slug: 'second', title: 'Second', access: 'protected', service: 'family' },
      { ...base, id: 'c', slug: 'third', title: 'Third', access: 'public', service: null },
    ];
    const binds: unknown[][] = [];
    const prepare = vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => {
        expect(sql).toContain('ORDER BY e.starts_at DESC, e.id ASC');
        binds.push(args);
        return { all: () => Promise.resolve({ results: args[2] === 'b' ? rows.slice(2) : rows }) };
      },
    }));
    const app = new Hono<AppEnv>();
    app.route('/api/v1', createPublicEventRoutes());
    const bindings = { DB: { prepare } as unknown as D1Database };

    const first = await app.request('/api/v1/galleries?limit=2', {}, bindings);
    expect(first.status).toBe(200);
    const firstPage = PublicEventListSchema.parse(await first.json());
    expect(firstPage.events).toEqual([expect.objectContaining({ id: 'a', service: 'wedding' })]);
    expect(firstPage.protectedGalleries).toEqual([expect.objectContaining({ id: 'b', service: 'family' })]);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(decodeGalleryCursor(firstPage.nextCursor ?? '')).toEqual({ access: 'all', startsAt, id: 'b' });

    const second = await app.request(`/api/v1/galleries?limit=2&cursor=${firstPage.nextCursor}`, {}, bindings);
    expect(second.status).toBe(200);
    const secondPage = PublicEventListSchema.parse(await second.json());
    expect(secondPage.events.map((event) => event.id)).toEqual(['c']);
    expect(secondPage.protectedGalleries).toEqual([]);
    expect(secondPage.nextCursor).toBeNull();
    expect(binds).toEqual([['all', null, null, 3], ['all', startsAt, 'b', 3]]);
    expect(prepare.mock.calls[0]?.[0]).toContain('e.id > ?3');
  });

  it('rejects invalid limits and cursors for another gallery access filter', async () => {
    const prepare = vi.fn();
    const app = new Hono<AppEnv>();
    app.onError(errorBoundary);
    app.route('/api/v1', createPublicEventRoutes());
    const bindings = { DB: { prepare } as unknown as D1Database };
    const cursor = encodeGalleryCursor({ access: 'all', startsAt: '2026-09-20T10:00:00.000Z', id: 'a' });
    expect((await app.request(`/api/v1/galleries?access=public&cursor=${cursor}`, {}, bindings)).status).toBe(400);
    expect((await app.request('/api/v1/galleries?limit=49', {}, bindings)).status).toBe(400);
    expect((await app.request('/api/v1/galleries?cursor=malformed', {}, bindings)).status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('hashes event passwords with a salt and distinct HMAC domain without storing plaintext', async () => {
    const encoded = await hashEventPassword('correct horse battery staple', authPepper);
    expect(encoded).not.toContain('correct horse battery staple');
    expect(encoded).toMatch(/^hmac-sha256\$/u);
    await expect(verifyEventPassword('correct horse battery staple', encoded, authPepper)).resolves.toBe(true);
    await expect(verifyEventPassword('wrong password', encoded, authPepper)).resolves.toBe(false);
    await expect(verifyPassword('correct horse battery staple', encoded, authPepper)).resolves.toBe(false);
    await expect(verifyEventPasswordDetailed('wrong password', encoded, authPepper)).resolves.toBe('mismatch');
    await expect(verifyEventPasswordDetailed('password', 'not-a-supported-hash', authPepper)).resolves.toBe('invalid-hash');
    await expect(verifyEventPasswordDetailed('password', encoded, undefined)).resolves.toBe('missing-pepper');
  });

  it('accepts the public showcase password only for the reserved event and explicit gate', () => {
    expect(isShowcasePrivateEventPassword('demo-private', 'cadrora-demo', 'true')).toBe(true);
    expect(isShowcasePrivateEventPassword('event-1', 'cadrora-demo', 'true')).toBe(false);
    expect(isShowcasePrivateEventPassword('demo-private', 'cadrora-demo', 'false')).toBe(false);
  });

  it('builds revisioned responsive sources and hides downloads when disabled', () => {
    const rows = [
      {
        id: 'photo-1', event_id: 'event-1', filename: 'moment.jpg', width: 1600, height: 1200,
        captured_at: null, sort_key: '001', revision: 3, variant: 'thumb' as const,
        liked: 1, selected_for_retouch: 1,
        content_type: 'image/jpeg' as const, variant_width: 480, variant_height: 360,
      },
      {
        id: 'photo-1', event_id: 'event-1', filename: 'moment.jpg', width: 1600, height: 1200,
        captured_at: null, sort_key: '001', revision: 3, variant: 'download' as const,
        liked: 1, selected_for_retouch: 1,
        content_type: 'image/jpeg' as const, variant_width: 1600, variant_height: 1200,
      },
    ];
    const photo = photosFromRows(rows, false)[0];
    expect(photo?.sources[0]?.url).toBe('/media/event-1/photo-1/3/thumb');
    expect(photo?.downloadUrl).toBeNull();
    expect(photo?.liked).toBe(false);
    expect(photo?.selectedForRetouch).toBe(false);
    expect(photosFromRows(rows, false, false, true)[0]?.liked).toBe(true);
    expect(photosFromRows(rows, false, false, true)[0]?.selectedForRetouch).toBe(true);
    expect(photosFromRows(rows, true)[0]?.downloadUrl).toBe('/media/event-1/photo-1/3/download');
    const withOriginal = [...rows, {
      ...rows[1]!, variant: 'original' as const, content_type: 'image/png' as const,
    }];
    expect(photosFromRows(withOriginal, true, true)[0]?.downloadUrl).toBe('/media/event-1/photo-1/3/original');
    expect(photosFromRows(withOriginal, true, false)[0]?.downloadUrl).toBe('/media/event-1/photo-1/3/download');
    expect(photosFromRows([rows[0]!], true)[0]?.downloadUrl).toBe('/media/event-1/photo-1/3/download');
  });

  it('keeps the frozen cache matrix exact', () => {
    expect(CACHE_CONTROL_BY_POLICY).toEqual({
      admin: 'no-store',
      asset: 'public, max-age=31536000, immutable',
      'event-protected': 'private, no-store',
      'event-public': 'public, max-age=60',
      'media-protected': 'private, max-age=3600',
      'media-public': 'public, max-age=60, must-revalidate',
      'media-download': 'private, no-store',
    });
  });

  it('requires the gallery to be online before resolving any R2 media key', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const statement = { bind: vi.fn(() => ({ first })) };
    const statements: string[] = [];
    const prepare = vi.fn((sql: string) => { statements.push(sql); return statement; });
    const media = new D1MediaRepository({ prepare } as unknown as D1Database);

    await expect(media.findPublishedVariant({
      eventId: 'event-1', photoId: 'photo-1', revision: 1, variant: 'thumb',
    })).resolves.toBeNull();

    expect(statements[0]).toContain('e.offline_at IS NULL');
  });

  it('resolves a missing download variant through the best generated copy', async () => {
    const bindings: unknown[][] = [];
    const row = {
      access: 'public', access_version: null, allow_downloads: 1, keep_originals: 0,
      byte_size: 40, content_type: 'image/webp', filename: 'photo.png', storage_key: 'large.webp',
    };
    const database = { prepare: () => ({ bind: (...values: unknown[]) => {
      bindings.push(values);
      return { first: () => Promise.resolve(row) };
    } }) } as unknown as D1Database;
    const media = new D1MediaRepository(database);
    expect((await media.findPublishedVariant({ eventId: 'event-1', photoId: 'photo-1', revision: 1, variant: 'download' }))?.storageKey).toBe('large.webp');
    expect(bindings[0]).toEqual(['event-1', 'photo-1', 1, 'download', 'large', 'medium', 'small', 'thumb']);
  });
});
