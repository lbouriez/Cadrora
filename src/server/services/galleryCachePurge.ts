import { purgePublicMediaCache } from './publicMediaCache';
import type { Context } from 'hono';
import type { AppEnv } from '../types';

export function edgeExecutionContext(context: Context<AppEnv>): unknown {
  try {
    return context.executionCtx;
  } catch {
    return null;
  }
}

/** The D1 update and this outbox insert must be committed in the same batch. */
export function galleryCachePurgeStatement(database: D1Database, eventId: string, now: string) {
  const jobId = crypto.randomUUID();
  return {
    jobId,
    statement: database.prepare(
      `INSERT INTO maintenance_jobs
         (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'purge_gallery_cache', 'pending', ?2, ?3, 0, ?4, ?4, ?4)`,
    ).bind(jobId, JSON.stringify({ eventId }), `purge-gallery-cache:${jobId}`, now),
  };
}

/** Fast path; the scheduled maintenance runner retries any unsuccessful purge. */
export async function tryImmediateGalleryCachePurge(
  database: D1Database,
  executionContext: unknown,
  eventId: string,
  jobId: string,
  now: string,
): Promise<void> {
  try {
    await purgePublicMediaCache(executionContext, eventId);
    await database.prepare(
      "UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1 AND state = 'pending'",
    ).bind(jobId, now).run();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown cache purge failure';
    try {
      await database.prepare(
        "UPDATE maintenance_jobs SET last_error = ?2, updated_at = ?3 WHERE id = ?1 AND state = 'pending'",
      ).bind(jobId, message.slice(0, 1_000), now).run();
    } catch {
      // The transaction already left the job pending; cron can still retry it.
    }
  }
}
