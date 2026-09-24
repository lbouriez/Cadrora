import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminEventRoutes } from '../../../src/server/routes/admin/galleries';
import type { AppEnv } from '../../../src/server/types';
import { CreateEventRequestSchema } from '../../../src/shared/schemas/gallery';

const eventRow = {
  id: 'gallery-1', slug: 'gallery-1', title: 'Gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'public', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 2,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

function app() {
  const instance = new Hono<AppEnv>();
  instance.use('*', async (context, next) => {
    context.set('requestId', 'original-cleanup-test');
    context.set('auth', { admin: {
      access: 'manage', authMode: 'password', createdAt: eventRow.created_at,
      expiresAt: '2030-01-02T00:00:00.000Z', id: 'session-1', revokedAt: null, subject: 'owner',
    } });
    await next();
  });
  instance.onError(errorBoundary);
  registerAdminEventRoutes(instance);
  return instance;
}

function resources(activeImports = 0, overrides: Partial<typeof eventRow> = {}, initialJobState: string | null = null) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  let jobState: string | null = initialJobState;
  const batch = vi.fn().mockResolvedValue([]);
  const prepare = vi.fn((sql: string) => {
    const record = { sql, values: [] as unknown[] };
    statements.push(record);
    const statement = {
      bind: (...values: unknown[]) => { record.values = values; return statement; },
      first: () => Promise.resolve(sql.includes('SELECT * FROM events') ? { ...eventRow, ...overrides }
        : sql.includes('COUNT(*) AS count, COALESCE') ? { count: 2, bytes: 800 }
        : sql.includes('SELECT COUNT(*) AS count FROM imports') ? { count: activeImports }
        : sql.includes("kind = 'delete_gallery_originals'") ? jobState ? { id: 'job-originals', state: jobState } : null
        : null),
      run: () => {
        if (sql.includes("VALUES (?1, 'delete_gallery_originals'")) jobState = 'pending';
        if (sql.includes("UPDATE imports SET state = 'cancelled'")) activeImports = 0;
        return Promise.resolve({ meta: { changes: 1 } });
      },
    };
    return statement;
  });
  return { batch, env: { DB: { batch, prepare } as unknown as D1Database } as CloudflareBindings, statements };
}

describe('gallery original delivery and cleanup', () => {
  it('rejects original delivery when downloads are disabled', () => {
    const result = CreateEventRequestSchema.safeParse({
      title: 'Gallery', startsAt: eventRow.starts_at, timezone: 'UTC',
      allowDownloads: false, keepOriginals: true,
    });
    expect(result.success).toBe(false);
  });

  it('reports the stored originals and queues cleanup without deleting R2 in the request', async () => {
    const { env, statements } = resources();
    const instance = app();
    const status = await instance.request('/api/v1/admin/galleries/gallery-1/originals', {}, env);
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toEqual({ count: 2, bytes: 800, activeImports: 0, cleanupState: 'idle' });

    const queued = await instance.request('/api/v1/admin/galleries/gallery-1/originals/cleanup', { method: 'POST' }, env);
    expect(queued.status).toBe(202);
    await expect(queued.json()).resolves.toMatchObject({ count: 2, cleanupState: 'pending' });
    expect(statements.some(({ sql }) => sql.includes("VALUES (?1, 'delete_gallery_originals'"))).toBe(true);
  });

  it('refuses cleanup while an original import is unfinished', async () => {
    const { env, statements } = resources(1);
    const response = await app().request('/api/v1/admin/galleries/gallery-1/originals/cleanup', { method: 'POST' }, env);
    expect(response.status).toBe(409);
    expect(statements.some(({ sql }) => sql.includes("VALUES (?1, 'delete_gallery_originals'"))).toBe(false);
  });

  it('lets the owner explicitly abandon unfinished original imports before cleanup', async () => {
    const { env, statements } = resources(1);
    const response = await app().request('/api/v1/admin/galleries/gallery-1/originals/abandon-imports', { method: 'POST' }, env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ activeImports: 0, count: 2 });
    expect(statements.some(({ sql }) => sql.includes("UPDATE imports SET state = 'cancelled'"))).toBe(true);
  });

  it('clears original delivery when downloads are switched off through a partial update', async () => {
    const { batch, env, statements } = resources(0, { allow_downloads: 1, keep_originals: 1 });
    const response = await app().request('/api/v1/admin/galleries/gallery-1', {
      body: JSON.stringify({ allowDownloads: false }), headers: { 'Content-Type': 'application/json' }, method: 'PATCH',
    }, env);
    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledOnce();
    expect(statements.some(({ sql, values }) => sql.startsWith('UPDATE events SET') &&
      sql.includes('allow_downloads') && sql.includes('keep_originals') && values[0] === 0 && values[1] === 0)).toBe(true);
  });

  it('prevents original delivery from being re-enabled during cleanup', async () => {
    const { batch, env } = resources(0, {}, 'pending');
    const response = await app().request('/api/v1/admin/galleries/gallery-1', {
      body: JSON.stringify({ allowDownloads: true, keepOriginals: true }),
      headers: { 'Content-Type': 'application/json' }, method: 'PATCH',
    }, env);
    expect(response.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });
});
