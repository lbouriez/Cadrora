import type { z } from '../../shared/zod';
import { APP_LOG_RETENTION_DAYS, MaintenanceOverviewSchema, MaintenanceJobPageSchema, type MaintenanceJobQuerySchema } from '../../shared/schemas/maintenance';
import { MAINTENANCE_LEASE_MS } from '../repositories/maintenanceRepository';

type RunRow = { started_at: string; finished_at: string | null; state: string; processed: number };
export async function maintenanceOverview(db: D1Database, now = new Date()) {
  const [counts, stale, lastRun, lastSuccess] = await Promise.all([
    db.prepare('SELECT state, COUNT(*) AS total FROM maintenance_jobs GROUP BY state').all<{ state: 'pending' | 'running' | 'failed' | 'completed'; total: number }>(),
    db.prepare("SELECT COUNT(*) AS total FROM maintenance_jobs WHERE state = 'running' AND updated_at <= ?")
      .bind(new Date(now.getTime() - MAINTENANCE_LEASE_MS).toISOString()).first<{ total: number }>(),
    db.prepare('SELECT started_at, finished_at, state, processed FROM maintenance_runs ORDER BY started_at DESC LIMIT 1').first<RunRow>(),
    db.prepare("SELECT finished_at FROM maintenance_runs WHERE state = 'completed' ORDER BY finished_at DESC LIMIT 1").first<{ finished_at: string }>(),
  ]);
  const totals = { pending: 0, running: 0, failed: 0, completed: 0, staleRunning: stale?.total ?? 0 };
  for (const row of counts.results) totals[row.state] = row.total;
  return MaintenanceOverviewSchema.parse({ observedAt: now.toISOString(), retentionDays: APP_LOG_RETENTION_DAYS,
    counts: totals, lastSuccessAt: lastSuccess?.finished_at ?? null,
    lastRun: lastRun ? { startedAt: lastRun.started_at, finishedAt: lastRun.finished_at, state: lastRun.state, processed: lastRun.processed } : null });
}

type JobRow = { id: string; kind: string; state: string; attempts: number; available_at: string;
  created_at: string; updated_at: string; gallery_id: string | null; has_error: number };
export async function listMaintenanceJobs(db: D1Database, query: z.infer<typeof MaintenanceJobQuerySchema>, now = new Date()) {
  const conditions = [query.state === 'active' ? "j.state IN ('pending', 'running', 'failed')" : 'j.state = ?'];
  const values: string[] = query.state === 'active' ? [] : [query.state];
  if (query.beforeCreatedAt && query.beforeId) {
    conditions.push('(j.created_at < ? OR (j.created_at = ? AND j.id < ?))');
    values.push(query.beforeCreatedAt, query.beforeCreatedAt, query.beforeId);
  }
  const rows = await db.prepare(`SELECT j.id, j.kind, j.state, j.attempts, j.available_at, j.created_at, j.updated_at,
    e.id AS gallery_id, CASE WHEN j.last_error IS NULL THEN 0 ELSE 1 END AS has_error
    FROM maintenance_jobs j LEFT JOIN events e ON e.id = CASE WHEN json_valid(j.payload_json) THEN json_extract(j.payload_json, '$.eventId') END
    WHERE ${conditions.join(' AND ')} ORDER BY j.created_at DESC, j.id DESC LIMIT 51`).bind(...values).all<JobRow>();
  const page = rows.results.slice(0, 50);
  const last = page.at(-1);
  return MaintenanceJobPageSchema.parse({ jobs: page.map((row) => ({ id: row.id, kind: row.kind, state: row.state,
    attempts: row.attempts, availableAt: row.available_at, createdAt: row.created_at, updatedAt: row.updated_at,
    galleryId: row.gallery_id, hasError: row.has_error === 1,
    leaseExpired: row.state === 'running' && Date.parse(row.updated_at) <= now.getTime() - MAINTENANCE_LEASE_MS })),
    nextCursor: rows.results.length > 50 && last ? { id: last.id, createdAt: last.created_at } : null });
}
