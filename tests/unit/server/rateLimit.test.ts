import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { authContext } from '../../../src/server/middleware/authContext';
import { createRateLimit, resetRateLimitForTests } from '../../../src/server/middleware/rateLimit';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('rateLimit middleware', () => {
  beforeEach(resetRateLimitForTests);

  it('enforces a best-effort sliding window', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.use('*', authContext);
    app.use('*', createRateLimit({ limit: 1, now: () => 1_000, windowMs: 10_000 }));
    app.get('/test', (context) => context.text('ok'));

    expect((await app.request('/test')).status).toBe(200);
    const response = await app.request('/test');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('10');
  });
});

