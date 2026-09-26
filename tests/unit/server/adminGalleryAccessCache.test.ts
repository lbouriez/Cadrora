import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { mockAdmin } from '../../../src/server/auth/testContext';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';

const row = {
  id: 'gallery-1', slug: 'gallery-1', title: 'Gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'public', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0,
  retouch_selection_enabled: 0, show_on_gallery_page: 1, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

describe('gallery public to protected cache fence', () => {
  it('commits the purge outbox with the access change and retains it when immediate purge is unavailable', async () => {
    let protectedAccess = false;
    const statements: string[] = [];
    const prepare = vi.fn((sql: string) => {
      statements.push(sql);
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn().mockImplementation(() => Promise.resolve(sql.includes('SELECT * FROM events')
          ? { ...row, access: protectedAccess ? 'protected' : 'public' } : null)),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      };
      return statement;
    });
    const batch = vi.fn().mockImplementation(() => {
      protectedAccess = true;
      return Promise.resolve([{ meta: { changes: 1 } }]);
    });
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', mockAdmin());
    registerAdminEventRoutes(app);

    const response = await app.request('/api/v1/admin/galleries/gallery-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access: 'protected', password: 'new-password-123' }),
    }, { DB: { prepare, batch } as unknown as D1Database, AUTH_PEPPER: 'a'.repeat(32) });

    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledOnce();
    expect(statements.some((sql) => sql.includes('UPDATE events SET access'))).toBe(true);
    expect(statements.some((sql) => sql.includes("'purge_gallery_cache'"))).toBe(true);
    expect(statements.some((sql) => sql.includes('SET last_error ='))).toBe(true);
  });
});
