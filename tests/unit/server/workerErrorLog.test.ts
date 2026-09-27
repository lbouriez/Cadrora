import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminWorkerErrorRoutes } from '../../../src/server/routes/admin/workerErrors';
import { listWorkerErrors, purgeOldWorkerErrors, recordWorkerError } from '../../../src/server/services/workerErrorLog';
import type { AppEnv } from '../../../src/server/types';
import { WorkerErrorListSchema } from '../../../src/shared/schemas/workerErrors';

describe('Worker error history', () => {
  it('records only classified diagnostics and purges entries older than 30 days', async () => {
    const bind = vi.fn(() => ({ run: vi.fn(() => Promise.resolve({ success: true })) }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    await recordWorkerError(db, {
      requestId: 'req-1', method: 'GET', path: '/api/v1/events/private-id/photos',
      code: 'INTERNAL_ERROR', category: 'unexpected',
    });
    expect(bind).toHaveBeenCalledWith(expect.any(String), 'req-1', 'GET', 'gallery-api', 'INTERNAL_ERROR', 'unexpected');
    await purgeOldWorkerErrors(db, new Date('2030-02-01T00:00:00.000Z'));
    expect(bind).toHaveBeenLastCalledWith('2030-01-02T00:00:00.000Z');
    expect(prepare).toHaveBeenLastCalledWith('DELETE FROM worker_errors WHERE occurred_at < ?1');
  });

  it('keeps the original error response if the diagnostic write fails', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => { context.set('requestId', 'req-2'); await next(); });
    app.onError(errorBoundary);
    app.get('/api/v1/test', () => { throw new Error('private provider object key'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await app.request('/api/v1/test', {}, {
        DB: { prepare: () => { throw new Error('D1 unavailable'); } } as unknown as D1Database,
      });
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain('private provider object key');
    } finally { consoleSpy.mockRestore(); }
  });

  it('requires owner access for the hidden list and returns bounded pages', async () => {
    const db = { prepare: () => ({ bind: () => ({ all: () => Promise.resolve({ results: [{
      id: 1, occurred_at: '2030-01-01T00:00:00.000Z', request_id: 'req-1',
      method: 'GET', route_group: 'gallery-api', code: 'INTERNAL_ERROR', category: 'unexpected',
    }] }) }) }) } as unknown as D1Database;
    expect((await listWorkerErrors(db)).errors).toHaveLength(1);
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'req-3');
      context.set('auth', { admin: {
        access: 'read-only', authMode: 'demo', createdAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'demo', revokedAt: null, subject: 'demo',
      } });
      await next();
    });
    app.onError(errorBoundary);
    registerAdminWorkerErrorRoutes(app);
    expect((await app.request('/api/v1/admin/worker-errors', {}, { DB: db })).status).toBe(403);

    const owner = new Hono<AppEnv>();
    owner.use('*', async (context, next) => {
      context.set('requestId', 'req-4');
      context.set('auth', { admin: {
        access: 'manage', authMode: 'password', createdAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'owner', revokedAt: null, subject: 'owner',
      } });
      await next();
    });
    owner.onError(errorBoundary);
    registerAdminWorkerErrorRoutes(owner);
    const response = await owner.request('/api/v1/admin/worker-errors', {}, { DB: db });
    expect(response.status).toBe(200);
    expect(WorkerErrorListSchema.parse(await response.json()).errors).toHaveLength(1);
  });
});
