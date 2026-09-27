import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { registerAdminWorkerErrorRoutes } from '../../../src/server/routes/admin/workerErrors';
import { scanMediaObjects } from '../../../src/server/services/mediaDiagnostics';
import type { AppEnv } from '../../../src/server/types';

describe('bounded R2 media diagnostics', () => {
  it('reports old untracked keys while ignoring recent uploads and retaining D1 references', async () => {
    const list = vi.fn(() => Promise.resolve({
      objects: [
        { key: 'events/a/photos/old/1/small.webp', uploaded: new Date('2030-01-01T00:00:00.000Z') },
        { key: 'events/a/photos/known/1/small.webp', uploaded: new Date('2030-01-01T00:00:00.000Z') },
        { key: 'events/a/photos/recent/1/small.webp', uploaded: new Date('2030-01-01T00:19:00.000Z') },
      ], truncated: true, cursor: 'next',
    }));
    const prepare = vi.fn((sql: string) => ({
      bind: (...keys: string[]) => ({ all: () => Promise.resolve({ results: keys.includes('events/a/photos/known/1/small.webp')
        ? [{ storage_key: 'events/a/photos/known/1/small.webp' }] : [] }) }),
      all: () => Promise.resolve({ results: sql.includes('maintenance_jobs') ? [{ state: 'failed', total: 2 }] : [] }),
    }));
    const result = await scanMediaObjects(
      { prepare } as unknown as D1Database,
      { list } as unknown as R2Bucket,
      'galleries', undefined, new Date('2030-01-01T00:20:00.000Z'),
    );
    expect(list).toHaveBeenCalledWith({ prefix: 'events/', limit: 100 });
    expect(result.scanned).toBe(3);
    expect(result.untracked.map((object) => object.key)).toEqual(['events/a/photos/old/1/small.webp']);
    expect(result.nextCursor).toBe('next');
    expect(result.failedCleanupJobs).toBe(2);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('FROM photo_variants'));
  });

  it('keeps the inventory behind owner access before touching R2', async () => {
    const list = vi.fn();
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'diag-request');
      context.set('auth', { admin: {
        access: 'read-only', authMode: 'demo', createdAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'demo', revokedAt: null, subject: 'demo',
      } });
      await next();
    });
    app.onError(errorBoundary);
    registerAdminWorkerErrorRoutes(app);
    const bindings = { MEDIA_BUCKET: { list } as unknown as R2Bucket };
    expect((await app.request('/api/v1/admin/diagnostics/media?scope=galleries', {}, bindings)).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
