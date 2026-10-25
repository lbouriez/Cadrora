import type { Context } from 'hono';

import type { EventGrant } from '../../shared/schemas';
import type { AppEnv } from '../types';
import { eventGrantSigningSecret, readEventGrantToken, verifyEventGrantToken } from './eventGrant';

/** Resolve after D1 maps a public slug to its canonical gallery ID. */
export async function resolveEventGrant(context: Context<AppEnv>, eventId: string): Promise<EventGrant | null> {
  const auth = context.get('auth');
  const cookies = context.req.header('Cookie');
  // Preserve explicitly injected verified contexts in isolated route tests.
  // Production authContext never creates a gallery grant without a cookie.
  if (!cookies) return auth.eventGrant?.eventId === eventId ? auth.eventGrant : null;
  const token = readEventGrantToken(cookies, eventId);
  const grant = token ? await verifyEventGrantToken(token, eventGrantSigningSecret(context.env)) : null;
  const otherAuth = { ...auth };
  delete otherAuth.eventGrant;
  if (grant?.eventId !== eventId) {
    context.set('auth', otherAuth);
    return null;
  }
  context.set('auth', { ...otherAuth, eventGrant: grant });
  return grant;
}
