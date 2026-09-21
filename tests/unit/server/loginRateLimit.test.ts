import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimitForTests,
} from '../../../src/server/middleware/loginRateLimit';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('failed-login limiter', () => {
  beforeEach(resetLoginRateLimitForTests);

  it('blocks attempts after five failed logins from one client', async () => {
    const now = 1_000;
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.use('*', createLoginRateLimit({ now: () => now }));
    app.post('/login', (context) => context.text('ok'));
    for (let index = 0; index < 5; index += 1) recordFailedLogin('203.0.113.10', now);

    const response = await app.request('/login', { headers: { 'CF-Connecting-IP': '203.0.113.10' }, method: 'POST' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('900');
  });

  it('keeps owner and published-demo failure buckets isolated', async () => {
    const now = 2_000;
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.use('*', createLoginRateLimit({ now: () => now }));
    app.post('/login', (context) => context.text('ok'));
    for (let index = 0; index < 5; index += 1) recordFailedLogin('203.0.113.20:owner', now);

    const demo = await app.request('/login', {
      body: JSON.stringify({ account: 'demo' }),
      headers: { 'CF-Connecting-IP': '203.0.113.20', 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const owner = await app.request('/login', {
      body: JSON.stringify({ account: 'owner' }),
      headers: { 'CF-Connecting-IP': '203.0.113.20', 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(demo.status).toBe(200);
    expect(owner.status).toBe(429);
  });
});
