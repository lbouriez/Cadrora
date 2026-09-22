import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { adminCsrf, authContext, requireAdmin } from '../../../src/server/middleware';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('admin protection', () => {
  it.each(['https://cadrora.example/api/v1/admin/galleries', 'https://cadrora.workers.dev/api/v1/admin/galleries'])(
    'requires an admin identity on %s',
    async (url) => {
      const app = new Hono<AppEnv>();
      app.use('*', requestId);
      app.onError(errorBoundary);
      app.use('*', authContext);
      app.get('/api/v1/admin/galleries', requireAdmin, (context) => context.json({ ok: true }));

      const response = await app.request(url);
      expect(response.status).toBe(401);
    },
  );

  it('rejects state-changing requests without an exact same Origin', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', adminCsrf);
    app.post('/api/v1/admin/login', (context) => context.json({ ok: true }));

    expect((await app.request('https://cadrora.example/api/v1/admin/login', { method: 'POST' })).status).toBe(403);
    expect((await app.request('https://cadrora.example/api/v1/admin/login', {
      headers: { Origin: 'https://attacker.example' },
      method: 'POST',
    })).status).toBe(403);
    expect((await app.request('https://cadrora.example/api/v1/admin/login', {
      headers: { Origin: 'https://cadrora.example' },
      method: 'POST',
    })).status).toBe(200);
  });
});
