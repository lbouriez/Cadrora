import { createMiddleware } from 'hono/factory';

import type { EventGrant, Session } from '../../shared/schemas';
import type { AppEnv } from '../types';

const TEST_DATE = '2030-01-01T00:00:00.000Z';

export function mockAdmin(overrides: Partial<Session> = {}) {
  return createMiddleware<AppEnv>(async (context, next) => {
    const session: Session = {
      id: 'test-admin-session',
      authMode: 'password',
      subject: 'test-admin',
      createdAt: '2029-12-31T16:00:00.000Z',
      expiresAt: TEST_DATE,
      revokedAt: null,
      ...overrides,
    };
    const current = context.get('auth');
    context.set('auth', { ...current, admin: session });
    await next();
  });
}

export function mockEventGrant(eventId: string, accessVersion = 1) {
  return createMiddleware<AppEnv>(async (context, next) => {
    const eventGrant: EventGrant = { eventId, accessVersion };
    const current = context.get('auth');
    context.set('auth', { ...current, eventGrant });
    await next();
  });
}

