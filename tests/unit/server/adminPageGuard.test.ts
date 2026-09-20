import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { adminPageGuard, authContext } from '../../../src/server/middleware';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

function bindings(mode: CloudflareBindings['ADMIN_AUTH_MODE']): CloudflareBindings {
  return { ADMIN_AUTH_MODE: mode } as unknown as CloudflareBindings;
}

describe('admin page guard', () => {
  function protectedApp() {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', authContext);
    app.use('*', adminPageGuard);
    app.get('*', (context) => context.text('admin shell'));
    return app;
  }

  it('allows only password login without a session and redirects other admin pages', async () => {
    const app = protectedApp();

    const login = await app.request('https://cadrora.workers.dev/admin/login', undefined, bindings('password'));
    expect(login.status).toBe(200);
    expect(login.headers.get('Cache-Control')).toBe('no-store');

    const dashboard = await app.request('https://cadrora.workers.dev/admin', undefined, bindings('password'));
    expect(dashboard.status).toBe(302);
    expect(dashboard.headers.get('Location')).toBe('/admin/login');
  });

  it('requires a verified Access identity on login and dashboard pages', async () => {
    const app = protectedApp();
    const response = await app.request('https://cadrora.workers.dev/admin/login', undefined, bindings('cloudflare-access'));
    expect(response.status).toBe(401);
  });
});
