import { WorkerErrorListSchema } from '../../shared/schemas/workerErrors';
import { AppLogInputSchema } from '../../shared/schemas/maintenance';
import { logCutoff, recordAppLog } from './appLog';

type ErrorRecord = { requestId: string; method: string; path: string; code: string; category: string };
type ErrorRow = { id: number; occurred_at: string; request_id: string; method: string; route_group: string; code: string; category: string };

function routeGroup(path: string): string {
  if (path.startsWith('/api/v1/admin/')) return 'admin-api';
  if (path.startsWith('/api/v1/events/') || path.startsWith('/api/v1/galleries/')) return 'gallery-api';
  if (path.startsWith('/api/v1/')) return 'public-api';
  if (path.startsWith('/media/')) return 'gallery-media';
  if (path.startsWith('/service-media/')) return 'service-media';
  if (path.startsWith('/portfolio-media/')) return 'portfolio-media';
  return 'other';
}

export async function recordWorkerError(db: D1Database | undefined, record: ErrorRecord): Promise<void> {
  const event = AppLogInputSchema.safeParse({ level: 'error', source: 'http', requestId: record.requestId,
    method: record.method, routeGroup: routeGroup(record.path), code: record.code, category: record.category });
  if (event.success) await recordAppLog(db, event.data);
}

export async function listWorkerErrors(db: D1Database, before?: number) {
  const cutoff = logCutoff();
  const rows = before
    ? await db.prepare("SELECT * FROM worker_errors WHERE source = 'http' AND level = 'error' AND id < ?1 AND occurred_at >= ?2 ORDER BY id DESC LIMIT 51")
      .bind(before, cutoff).all<ErrorRow>()
    : await db.prepare("SELECT * FROM worker_errors WHERE source = 'http' AND level = 'error' AND occurred_at >= ?1 ORDER BY id DESC LIMIT 51")
      .bind(cutoff).all<ErrorRow>();
  const page = rows.results.slice(0, 50);
  return WorkerErrorListSchema.parse({
    errors: page.map((row) => ({
      id: row.id, occurredAt: row.occurred_at, requestId: row.request_id,
      method: row.method, routeGroup: row.route_group, code: row.code, category: row.category,
    })),
    nextBefore: rows.results.length > 50 ? page.at(-1)?.id ?? null : null,
  });
}

export async function purgeOldWorkerErrors(db: D1Database, now = new Date()): Promise<void> {
  await db.prepare('DELETE FROM worker_errors WHERE id IN (SELECT id FROM worker_errors WHERE occurred_at < ?1 ORDER BY occurred_at LIMIT 1000)').bind(logCutoff(now)).run();
}
