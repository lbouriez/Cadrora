import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { mockAdmin } from '../../../src/server/auth/testContext';
import { authContext } from '../../../src/server/middleware/authContext';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';

const galleryRow = {
  access: 'public' as const,
  allow_downloads: 0,
  cover_photo_id: null,
  created_at: '2030-01-01T00:00:00.000Z',
  deleting_at: null,
  description: null,
  face_search_enabled: 1,
  id: 'gallery-1',
  keep_originals: 0,
  nearby_search_enabled: 1,
  offline_at: null,
  retention_days: null,
  revision: 1,
  show_photo_metadata: 0,
  show_on_gallery_page: 1,
  slug: 'summer-story',
  starts_at: '2030-01-01T00:00:00.000Z',
  timezone: 'UTC',
  title: 'Summer Story',
  updated_at: '2030-01-01T00:00:00.000Z',
  visibility: 'published' as const,
};

function testApp() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', authContext);
  app.use('*', mockAdmin());
  registerAdminEventRoutes(app);
  return app;
}

function fakeDatabase() {
  const statements: Array<{ binds: unknown[]; query: string }> = [];
  const prepare = vi.fn((query: string) => {
    const record = { binds: [] as unknown[], query };
    statements.push(record);
    const statement = {
      bind: vi.fn((...binds: unknown[]) => {
        record.binds = binds;
        return statement;
      }),
      first: vi.fn().mockResolvedValue(query.includes('SELECT * FROM events') ? galleryRow : null),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    };
    return statement;
  });
  const batch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }]);
  return { batch, database: { batch, prepare } as unknown as D1Database, statements };
}

describe('gallery deletion', () => {
  it('rejects a confirmation that does not exactly match the gallery title', async () => {
    const { batch, database } = fakeDatabase();
    const response = await testApp().request('/api/v1/admin/galleries/gallery-1', {
      body: JSON.stringify({ confirmation: 'summer story' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    }, { DB: database });

    expect(response.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  it('takes the gallery offline and queues idempotent provider cleanup', async () => {
    const { batch, database, statements } = fakeDatabase();
    const response = await testApp().request('/api/v1/admin/galleries/gallery-1', {
      body: JSON.stringify({ confirmation: 'Summer Story' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    }, { DB: database });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ deletionQueued: true });
    expect(batch).toHaveBeenCalledOnce();
    expect(statements.some(({ query }) => query.includes('SET offline_at = COALESCE'))).toBe(true);
    expect(statements.some(({ query }) => query.includes("'delete_gallery'"))).toBe(true);
    expect(statements.some(({ binds }) => binds.includes('delete-gallery:gallery-1'))).toBe(true);
  });
});
