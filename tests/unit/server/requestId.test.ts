import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { REQUEST_ID_HEADER } from '../../../src/shared/constants';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('requestId middleware', () => {
  it('propagates a safe request id', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.get('/test', (context) => context.json({ requestId: context.get('requestId') }));

    const response = await app.request('/test', { headers: { [REQUEST_ID_HEADER]: 'test-123' } });

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('test-123');
    expect(await response.json()).toEqual({ requestId: 'test-123' });
  });

  it('replaces an unsafe request id', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.get('/test', (context) => context.text(context.get('requestId')));

    const response = await app.request('/test', { headers: { [REQUEST_ID_HEADER]: 'bad id' } });
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[a-f0-9-]{36}$/);
  });
});
