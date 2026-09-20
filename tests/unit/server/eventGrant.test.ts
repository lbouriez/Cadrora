import { describe, expect, it } from 'vitest';

import {
  EVENT_GRANT_COOKIE,
  createEventGrantToken,
  eventGrantCookie,
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
    const token = readEventGrantToken(cookie);

    expect(cookie).toContain(`${EVENT_GRANT_COOKIE}=`);
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(token).not.toBeNull();
    await expect(
      verifyEventGrantToken(token!, 'turnstile-secret', new Date('2030-01-01T09:00:00.000Z')),
    ).resolves.toBeNull();
  });
});

