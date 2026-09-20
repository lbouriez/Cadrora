import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { mockAdmin, mockEventGrant } from '../../../src/server/auth/testContext';
import { authContext } from '../../../src/server/middleware/authContext';
import type { AppEnv } from '../../../src/server/types';

describe('authentication test context', () => {
  it('provides typed admin and event grant mocks', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authContext);
    app.use('*', mockAdmin());
    app.use('*', mockEventGrant('event-1', 2));
    app.get('/test', (context) => context.json(context.get('auth')));

    const body = await (await app.request('/test')).json();
    expect(body).toMatchObject({
      admin: { subject: 'test-admin' },
      eventGrant: { eventId: 'event-1', accessVersion: 2 },
    });
  });
});

