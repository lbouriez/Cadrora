import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';
import { AdminEventListSchema } from '../../../src/shared/schemas/gallery';

const eventRow = {
  id: 'gallery-1', slug: 'gallery-1', title: 'Gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'public', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0,
  retouch_selection_enabled: 1, show_on_gallery_page: 1, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
  retouch_selection_count: 0,
};

describe('admin gallery metrics', () => {
  it('returns D1-recorded bytes and active photo counts, including empty galleries', async () => {
    const prepare = vi.fn((sql: string) => ({
      bind: () => ({ all: () => Promise.resolve({ results: [
        { ...eventRow, photo_count: 12, storage_bytes: 1_750_000 },
        { ...eventRow, id: 'gallery-2', slug: 'gallery-2', photo_count: 0, storage_bytes: 0 },
      ] }) }),
      sql,
    }));
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'gallery-storage-test');
      context.set('auth', { admin: {
        access: 'manage', authMode: 'password', createdAt: eventRow.created_at,
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
      } });
      await next();
    });
    app.onError(errorBoundary);
    registerAdminEventRoutes(app);

    const response = await app.request('/api/v1/admin/galleries', {}, {
      DB: { prepare } as unknown as D1Database,
    });
    expect(response.status).toBe(200);
    const body = AdminEventListSchema.parse(await response.json());
    expect(body.nextCursor).toBeNull();
    expect(body.events.map(({ id, photoCount, storageBytes }) => ({ id, photoCount, storageBytes }))).toEqual([
      { id: 'gallery-1', photoCount: 12, storageBytes: 1_750_000 },
      { id: 'gallery-2', photoCount: 0, storageBytes: 0 },
    ]);
    const query = prepare.mock.calls[0]?.[0] ?? '';
    expect(query).toContain("p.state NOT IN ('deleting', 'deleted')");
    expect(query).toContain('SUM(v.byte_size)');
    expect(query).toContain('JOIN photo_variants v ON v.photo_id = p.id');
    expect(query).not.toContain('v.variant =');
  });

  it('continues a bounded keyset page without repeating the last gallery', async () => {
    const rows = [
      { ...eventRow, id: 'gallery-1', slug: 'gallery-1', photo_count: 1, storage_bytes: 100 },
      { ...eventRow, id: 'gallery-2', slug: 'gallery-2', photo_count: 1, storage_bytes: 100 },
      { ...eventRow, id: 'gallery-3', slug: 'gallery-3', photo_count: 1, storage_bytes: 100 },
    ];
    const bound = vi.fn((...args: unknown[]) => ({
      all: () => Promise.resolve({ results: args.length === 1 ? rows.slice(0, 3) : rows.slice(2) }),
    }));
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'gallery-pagination-test');
      context.set('auth', { admin: {
        access: 'manage', authMode: 'password', createdAt: eventRow.created_at,
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
      } });
      await next();
    });
    app.onError(errorBoundary);
    registerAdminEventRoutes(app);
    const env = { DB: { prepare: () => ({ bind: bound }) } as unknown as D1Database };
    const first = AdminEventListSchema.parse(await (await app.request('/api/v1/admin/galleries?limit=2', {}, env)).json());
    expect(first.events.map((event) => event.id)).toEqual(['gallery-1', 'gallery-2']);
    expect(first.nextCursor).toBeTruthy();
    const second = AdminEventListSchema.parse(await (await app.request(
      `/api/v1/admin/galleries?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`, {}, env,
    )).json());
    expect(second.events.map((event) => event.id)).toEqual(['gallery-3']);
    expect(second.nextCursor).toBeNull();
    expect(bound).toHaveBeenLastCalledWith(eventRow.starts_at, 'gallery-2', 3);
  });
});
