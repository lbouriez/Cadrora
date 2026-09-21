import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createDemoSession, demoSessionCookie, verifyDemoSession } from '../../../src/server/auth';
import { authContext } from '../../../src/server/middleware';
import type { AppEnv } from '../../../src/server/types';

describe('stateless read-only demo sessions', () => {
  it('round trips an explicit read-only capability without D1', async () => {
    const now = new Date('2030-01-01T12:00:00.000Z');
    const created = await createDemoSession('a high entropy signing secret', now);
    const session = await verifyDemoSession(created.token, 'a high entropy signing secret', now);
    expect(session).toMatchObject({ access: 'read-only', authMode: 'demo', subject: 'demo' });
  });

  it('rejects tampering, a wrong signing key, and expiry', async () => {
    const now = new Date('2030-01-01T12:00:00.000Z');
    const created = await createDemoSession('correct signing secret', now);
    await expect(verifyDemoSession(`${created.token}x`, 'correct signing secret', now)).resolves.toBeNull();
    await expect(verifyDemoSession(created.token, 'wrong signing secret', now)).resolves.toBeNull();
    await expect(verifyDemoSession(created.token, 'correct signing secret', new Date('2030-01-01T13:00:01.000Z'))).resolves.toBeNull();
  });

  it('accepts a demo cookie only behind the explicit showcase runtime gate', async () => {
    const now = new Date();
    const secret = 'a high entropy signing secret';
    const created = await createDemoSession(secret, now);
    const cookie = demoSessionCookie(created.token, created.session.expiresAt, now);
    const app = new Hono<AppEnv>();
    app.use('*', authContext);
    app.get('/', (context) => context.json({ session: context.get('auth').admin ?? null }));
    const base = {
      ADMIN_AUTH_MODE: 'password',
      ADMIN_SECRET_HASH: secret,
      DB: {} as D1Database,
    } as CloudflareBindings;

    const disabled = await app.request('/', { headers: { Cookie: cookie } }, {
      ...base,
      DEMO_SHOWCASE_ENABLED: 'false',
    });
    const enabled = await app.request('/', { headers: { Cookie: cookie } }, {
      ...base,
      DEMO_SHOWCASE_ENABLED: 'true',
    });

    await expect(disabled.json()).resolves.toEqual({ session: null });
    await expect(enabled.json()).resolves.toMatchObject({ session: { access: 'read-only', authMode: 'demo' } });
  });
});
