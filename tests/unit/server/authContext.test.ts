import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { authContext } from '../../../src/server/middleware/authContext';
import type { AppEnv } from '../../../src/server/types';

describe('authContext middleware', () => {
  it('resolves missing authentication to an empty context without throwing', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authContext);
    app.get('/test', (context) => context.json(context.get('auth')));

    const response = await app.request('/test');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });
});

