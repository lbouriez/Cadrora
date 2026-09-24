import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { createAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';

const event = {
  id: 'gallery-1', slug: 'private-gallery', title: 'Private gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'protected', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

function harness(access: 'manage' | 'read-only' = 'manage') {
  const sqlCalls: string[] = [];
  const batches: string[][] = [];
  const prepare = vi.fn((sql: string) => {
    sqlCalls.push(sql);
    const statement = {
      sql,
      bind: () => statement,
      first: () => Promise.resolve(sql.startsWith('SELECT * FROM events') ? event
        : sql.includes('COUNT(*) AS total FROM photos') ? { total: 1 }
          : sql.includes('SELECT id, revision, face_state FROM photos') ? { id: 'photo-1', revision: 2, face_state: 'disabled' }
            : sql.includes('SELECT replacement_photo_id') ? { replacement_photo_id: 'photo-1', replacement_applied_at: null, state: 'completed', total_photos: 1 }
              : sql.includes('SELECT id, filename, content_type, width, height FROM photos') ? { id: 'staged-1', filename: 'edited.jpg', content_type: 'image/jpeg', width: 1000, height: 800 }
                : null),
      all: () => Promise.resolve(sql.includes('SELECT storage_key FROM photo_variants')
        ? { results: [{ storage_key: 'events/gallery-1/photos/photo-1/2/medium.webp' }] }
        : { results: [{ id: 'photo-1', filename: 'photo.jpg', revision: 2, pending_import_id: null }] }),
    };
    return statement;
  });
  const batch = vi.fn((statements: unknown[]) => {
    batches.push(statements.map((statement) => (statement as { sql: string }).sql));
    return Promise.resolve([]);
  });
  const app = new Hono<AppEnv>();
  app.use('*', async (context, next) => {
    context.set('requestId', 'selection-test');
    context.set('auth', { admin: { access, subject: 'owner', id: 'test', authMode: 'password',
      createdAt: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-02T00:00:00.000Z', revokedAt: null } });
    await next();
  });
  app.onError(errorBoundary);
  app.route('/api/v1/admin', createAdminEventRoutes());
  const env = { DB: { prepare, batch } as unknown as D1Database } as CloudflareBindings;
  return { app, batches, env, sqlCalls };
}

describe('admin private-gallery selections', () => {
  it('lists retouch selections separately from hearts and permits read-only inspection', async () => {
    const test = harness('read-only');
    const retouch = await test.app.request('/api/v1/admin/galleries/gallery-1/selections', {}, test.env);
    expect(retouch.status).toBe(200);
    expect(test.sqlCalls.some((sql) => sql.includes('p.selected_for_retouch = 1'))).toBe(true);
    const favorites = await test.app.request('/api/v1/admin/galleries/gallery-1/selections?view=favorites', {}, test.env);
    expect(favorites.status).toBe(200);
    expect(test.sqlCalls.some((sql) => sql.includes('p.liked = 1'))).toBe(true);
    expect((await test.app.request('/api/v1/admin/galleries/gallery-1/selections?view=anything', {}, test.env)).status).toBe(400);
  });

  it('blocks read-only replacement before accessing its import or media', async () => {
    const test = harness('read-only');
    const response = await test.app.request('/api/v1/admin/galleries/gallery-1/photos/photo-1/download', {}, test.env);
    expect(response.status).toBe(403);
    expect(test.sqlCalls).toHaveLength(0);
  });

  it('queues guarded cleanup before swapping variants on replacement', async () => {
    const test = harness();
    const response = await test.app.request('/api/v1/admin/galleries/gallery-1/photos/photo-1/replace', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importId: 'import-1' }),
    }, test.env);
    expect(response.status).toBe(200);
    expect(test.batches).toHaveLength(1);
    expect(test.batches[0]?.[0]).toContain('CASE WHEN EXISTS');
  });
});
