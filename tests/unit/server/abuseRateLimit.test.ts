import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { abuseRateLimit, limitedOperation } from '../../../src/server/middleware/abuseRateLimit';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

function testApp() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.use('*', abuseRateLimit);
  app.post('/api/v1/admin/login', (context) => context.text('ok'));
  app.post('/api/v1/galleries/:eventId/unlock', (context) => context.text('ok'));
  app.post('/api/v1/galleries/:eventId/face-search', (context) => context.text('ok'));
  app.get('/api/v1/galleries/:eventId/photos', (context) => context.text('ok'));
  return app;
}

describe('Cloudflare abuse rate limiting', () => {
  it('limits only costly POST operations before they reach their handler', () => {
    expect(limitedOperation('POST', '/api/v1/admin/login')).toBe('auth');
    expect(limitedOperation('POST', '/api/v1/galleries/gallery-1/unlock')).toBe('auth');
    expect(limitedOperation('POST', '/api/v1/galleries/gallery-1/face-search')).toBe('face');
    expect(limitedOperation('GET', '/api/v1/galleries/gallery-1/photos')).toBeNull();
  });

  it('uses separate auth and face bindings and returns a bounded 429', async () => {
    const authLimit = vi.fn(() => Promise.resolve({ success: true }));
    const faceLimit = vi.fn(() => Promise.resolve({ success: false }));
    const env = {
      AUTH_RATE_LIMITER: { limit: authLimit }, FACE_RATE_LIMITER: { limit: faceLimit },
    } as unknown as CloudflareBindings;
    const app = testApp();
    const headers = { 'CF-Connecting-IP': '192.0.2.5' };
    expect((await app.request('https://cadrora.example/api/v1/admin/login', { method: 'POST', headers }, env)).status).toBe(200);
    expect((await app.request('https://cadrora.example/api/v1/galleries/gallery-1/unlock', { method: 'POST', headers }, env)).status).toBe(200);
    const response = await app.request('https://cadrora.example/api/v1/galleries/gallery-1/face-search', { method: 'POST', headers }, env);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(authLimit).toHaveBeenCalledTimes(2);
    expect(authLimit).toHaveBeenCalledWith({ key: 'cadrora.example:auth:192.0.2.5' });
    expect(faceLimit).toHaveBeenCalledWith({ key: 'cadrora.example:face:192.0.2.5' });
  });

  it('fails closed if a required limiter binding is absent or unavailable', async () => {
    const app = testApp();
    const missing = await app.request('/api/v1/admin/login', { method: 'POST' });
    expect(missing.status).toBe(503);
    const failing = await app.request('/api/v1/galleries/gallery-1/face-search', { method: 'POST' }, {
      FACE_RATE_LIMITER: { limit: () => Promise.reject(new Error('provider private detail')) },
    });
    expect(failing.status).toBe(503);
    expect(JSON.stringify(await failing.json())).not.toContain('provider private detail');
    expect((await app.request('/api/v1/galleries/gallery-1/photos')).status).toBe(200);
  });
});
