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

describe('admin gallery storage', () => {
  it('returns D1-recorded bytes for each gallery, including empty galleries', async () => {
    const prepare = vi.fn((sql: string) => ({
      all: () => Promise.resolve({ results: [
        { ...eventRow, storage_bytes: 1_750_000 },
        { ...eventRow, id: 'gallery-2', slug: 'gallery-2', storage_bytes: 0 },
      ] }),
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
    expect(body.events.map(({ id, storageBytes }) => ({ id, storageBytes }))).toEqual([
      { id: 'gallery-1', storageBytes: 1_750_000 },
      { id: 'gallery-2', storageBytes: 0 },
    ]);
    const query = prepare.mock.calls[0]?.[0] ?? '';
    expect(query).toContain('SUM(v.byte_size)');
    expect(query).toContain('JOIN photo_variants v ON v.photo_id = p.id');
    expect(query).not.toContain('v.variant =');
  });
});
