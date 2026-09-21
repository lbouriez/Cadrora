import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { demoReadOnly } from '../../../src/server/middleware';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

function demoApp() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', async (context, next) => {
    context.set('auth', {
      admin: {
        access: 'read-only',
        authMode: 'demo',
        createdAt: '2030-01-01T00:00:00.000Z',
        expiresAt: '2030-01-01T01:00:00.000Z',
        id: 'demo:test',
        revokedAt: null,
        subject: 'demo',
      },
    });
    await next();
  });
  app.use('/api/v1/admin/*', demoReadOnly);
  return app;
}

describe('demo read-only API boundary', () => {
  it('allows only the explicit safe read endpoints', async () => {
    const app = demoApp();
    app.get('/api/v1/admin/events', (context) => context.json({ ok: true }));
    app.get('/api/v1/admin/events/:eventId/publication', (context) => context.json({ ok: true }));
    expect((await app.request('/api/v1/admin/events')).status).toBe(200);
    expect((await app.request('/api/v1/admin/events/event-1/publication')).status).toBe(200);
  });

  it('rejects mutations before a repository handler can run', async () => {
    const app = demoApp();
    const mutate = vi.fn();
    app.post('/api/v1/admin/events', (context) => {
      mutate();
      return context.json({ ok: true });
    });
    const response = await app.request('/api/v1/admin/events', { method: 'POST' });
    expect(response.status).toBe(403);
    expect(mutate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: 'DEMO_READ_ONLY' });
  });

  it('fails closed for a future non-allowlisted GET endpoint', async () => {
    const app = demoApp();
    app.get('/api/v1/admin/export', (context) => context.json({ ok: true }));
    expect((await app.request('/api/v1/admin/export')).status).toBe(403);
  });
});
