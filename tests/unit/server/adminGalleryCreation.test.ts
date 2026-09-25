import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';

describe('gallery creation without a gallery-count quota', () => {
  it('creates a gallery without a count query or quota bindings', async () => {
    const queries: string[] = [];
    const prepare = vi.fn((query: string) => {
      queries.push(query);
      let values: unknown[] = [];
      const statement = {
        bind: (...bound: unknown[]) => { values = bound; return statement; },
        first: () => Promise.resolve(query.includes('SELECT * FROM events') ? {
          id: values[0], slug: 'new-gallery', title: 'New gallery', description: null,
          starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
          visibility: 'draft', access: 'public', allow_downloads: 0,
          face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0,
          retouch_selection_enabled: 1, show_on_gallery_page: 1, keep_originals: 0,
          retention_days: null, offline_at: null, deleting_at: null, revision: 0,
          created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
        } : null),
      };
      return statement;
    });
    const batch = vi.fn().mockResolvedValue([]);
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'gallery-creation-test');
      context.set('auth', { admin: {
        access: 'manage', authMode: 'password', createdAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
      } });
      await next();
    });
    app.onError(errorBoundary);
    registerAdminEventRoutes(app);

    const response = await app.request('/api/v1/admin/galleries', {
      body: JSON.stringify({ title: 'New gallery', startsAt: '2030-01-01T00:00:00.000Z', timezone: 'UTC' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }, { DB: { prepare, batch } as unknown as D1Database });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: 'New gallery' });
    expect(batch).toHaveBeenCalledOnce();
    expect(queries.some((query) => query.includes('COUNT(*)') || query.includes('owner_gallery_limit'))).toBe(false);
  });
});
