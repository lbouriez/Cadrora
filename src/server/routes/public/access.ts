import type { Context } from 'hono';

import type { AppEnv } from '../../types';
import type { Event } from '../../../shared/schemas';

export function hasEventAccess(context: Context<AppEnv>, event: Event): boolean {
  if (event.access === 'public') return true;
  const grant = context.get('auth').eventGrant;
  return grant?.eventId === event.id && grant.accessVersion > 0;
}

export async function currentAccessVersion(database: D1Database, eventId: string): Promise<number | null> {
  const row = await database
    .prepare('SELECT access_version FROM event_credentials WHERE event_id = ?1')
    .bind(eventId)
    .first<{ access_version: number }>();
  return row?.access_version ?? null;
}

export async function hasCurrentEventAccess(
  context: Context<AppEnv>,
  event: Event,
): Promise<boolean> {
  if (!hasEventAccess(context, event)) return false;
  if (event.access === 'public') return true;
  const version = await currentAccessVersion(context.env.DB, event.id);
  return version !== null && context.get('auth').eventGrant?.accessVersion === version;
}
