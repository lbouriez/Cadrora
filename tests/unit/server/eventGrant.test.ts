import { describe, expect, it } from 'vitest';

import {
  EVENT_GRANT_COOKIE,
  createEventGrantToken,
  eventGrantCookie,
  eventGrantCookieName,
  eventGrantSigningSecret,
  readEventGrantToken,
  verifyEventGrantToken,
} from '../../../src/server/auth/eventGrant';

describe('event grant', () => {
  const now = new Date('2030-01-01T00:00:00.000Z');

  it('round trips an event-scoped signed grant', async () => {
    const token = await createEventGrantToken(
      { eventId: 'event-1', accessVersion: 3 },
      'turnstile-secret',
      '8',
      now,
    );

    await expect(verifyEventGrantToken(token, 'turnstile-secret', now)).resolves.toEqual({
      eventId: 'event-1',
      accessVersion: 3,
    });
    await expect(verifyEventGrantToken(token, 'wrong-secret', now)).resolves.toBeNull();
  });

  it('expires and emits a secure host cookie', async () => {
    const cookie = await eventGrantCookie(
      { eventId: 'event-1', accessVersion: 1 },
      'turnstile-secret',
      '8',
      now,
    );
    const token = readEventGrantToken(cookie, 'event-1');

    expect(cookie).toContain(`${eventGrantCookieName('event-1')}=`);
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(token).not.toBeNull();
    await expect(
      verifyEventGrantToken(token!, 'turnstile-secret', new Date('2030-01-01T09:00:00.000Z')),
    ).resolves.toBeNull();
  });

  it('uses the stable pepper so an admin-password rotation does not revoke grants', () => {
    expect(eventGrantSigningSecret({ AUTH_PEPPER: 'stable-auth-pepper' })).toBe('stable-auth-pepper');
    expect(eventGrantSigningSecret({})).toBeUndefined();
  });

  it('keeps independent gallery cookies and accepts a legacy grant during migration', async () => {
    const first = await eventGrantCookie({ eventId: 'event-1', accessVersion: 1 }, 'secret', '8', now);
    const second = await eventGrantCookie({ eventId: 'event-2', accessVersion: 2 }, 'secret', '8', now);
    const cookies = `${first.split(';')[0]}; ${second.split(';')[0]}`;
    expect(eventGrantCookieName('event-1')).not.toBe(eventGrantCookieName('event-2'));
    for (const [eventId, accessVersion] of [['event-1', 1], ['event-2', 2]] as const) {
      const token = readEventGrantToken(cookies, eventId);
      await expect(verifyEventGrantToken(token ?? '', 'secret', now)).resolves.toEqual({ eventId, accessVersion });
    }
    const legacyToken = await createEventGrantToken({ eventId: 'event-1', accessVersion: 1 }, 'secret', '8', now);
    expect(readEventGrantToken(`${EVENT_GRANT_COOKIE}=${legacyToken}`, 'event-1')).toBe(legacyToken);
    expect(readEventGrantToken(`${EVENT_GRANT_COOKIE}=${legacyToken}; ${eventGrantCookieName('event-1')}=malformed`, 'event-1')).toBeNull();
  });
});
