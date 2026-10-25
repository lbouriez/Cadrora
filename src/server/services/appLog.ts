import { APP_LOG_RETENTION_DAYS, AppLogInputSchema, AppLogPageSchema } from '../../shared/schemas/maintenance';
import type { AppLogInput, AppLogQuerySchema } from '../../shared/schemas/maintenance';
import type { z } from '../../shared/zod';

/** One bounded structured logging boundary, usable by future server modules. */
export async function recordAppLog(db: D1Database | undefined, input: AppLogInput, now = new Date()): Promise<void> {
  const parsed = AppLogInputSchema.safeParse(input);
  if (!parsed.success) return;
  const event = parsed.data;
  // Console output gives operators a fallback when D1 itself is unavailable.
  console[event.level === 'info' ? 'info' : event.level === 'warn' ? 'warn' : 'error']('cadrora_app_event', event);
  if (!db) return;
  try {
    await db.prepare(`INSERT INTO worker_errors
      (occurred_at, request_id, method, route_group, code, category, level, source, job_id, job_kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(now.toISOString(), event.requestId, event.method, event.routeGroup, event.code, event.category,
        event.level, event.source, event.jobId, event.jobKind).run();
  } catch {
    // Never recurse, retain provider exception text, or fail the original operation.
    console.warn('cadrora_app_log_persistence_unavailable');
  }
}

export function logCutoff(now = new Date()): string {
  return new Date(now.getTime() - APP_LOG_RETENTION_DAYS * 86_400_000).toISOString();
}

type LogRow = { id: number; occurred_at: string; request_id: string; method: string; route_group: string;
  code: string; category: string; level: string; source: string; job_id: string | null; job_kind: string | null };

export async function listAppLogs(db: D1Database, query: z.infer<typeof AppLogQuerySchema>, now = new Date()) {
  const where = ['occurred_at >= ?'];
  const values: (string | number)[] = [logCutoff(now)];
  if (query.before) { where.push('id < ?'); values.push(query.before); }
  if (query.level) { where.push('level = ?'); values.push(query.level); }
  if (query.source) { where.push('source = ?'); values.push(query.source); }
  const result = await db.prepare(`SELECT * FROM worker_errors WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 51`).bind(...values).all<LogRow>();
  const page = result.results.slice(0, 50);
  return AppLogPageSchema.parse({ retentionDays: APP_LOG_RETENTION_DAYS,
    logs: page.map((row) => ({ id: row.id, occurredAt: row.occurred_at, requestId: row.request_id,
      method: row.method, routeGroup: row.route_group, code: row.code, category: row.category, level: row.level,
      source: row.source, jobId: row.job_id, jobKind: row.job_kind })),
    nextBefore: result.results.length > 50 ? page.at(-1)?.id ?? null : null });
}

/** Bounded retention work; repeated Cron runs drain a backlog without one huge delete. */
export async function purgeAppHistory(db: D1Database, now = new Date()): Promise<void> {
  const cutoff = logCutoff(now);
  await db.batch([
    db.prepare('DELETE FROM worker_errors WHERE id IN (SELECT id FROM worker_errors WHERE occurred_at < ? ORDER BY occurred_at LIMIT 1000)').bind(cutoff),
    db.prepare('DELETE FROM maintenance_runs WHERE id IN (SELECT id FROM maintenance_runs WHERE started_at < ? ORDER BY started_at LIMIT 1000)').bind(cutoff),
  ]);
}
