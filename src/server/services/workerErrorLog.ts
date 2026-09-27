import { WorkerErrorListSchema } from '../../shared/schemas/workerErrors';

const RETENTION_DAYS = 30;

type ErrorRecord = { requestId: string; method: string; path: string; code: string; category: string };
type ErrorRow = { id: number; occurred_at: string; request_id: string; method: string; route_group: string; code: string; category: string };

function routeGroup(path: string): string {
  if (path.startsWith('/api/v1/admin/')) return 'admin-api';
  if (path.startsWith('/api/v1/events/')) return 'gallery-api';
  if (path.startsWith('/api/v1/')) return 'public-api';
  if (path.startsWith('/media/')) return 'gallery-media';
  if (path.startsWith('/service-media/')) return 'service-media';
  if (path.startsWith('/portfolio-media/')) return 'portfolio-media';
  return 'other';
}

export async function recordWorkerError(db: D1Database | undefined, record: ErrorRecord): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(`INSERT INTO worker_errors
      (occurred_at, request_id, method, route_group, code, category)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(new Date().toISOString(), record.requestId, record.method.slice(0, 16),
        routeGroup(record.path), record.code.slice(0, 80), record.category.slice(0, 32)).run();
  } catch {
    // Diagnostics must never replace the original response or recurse on D1 failures.
  }
}

export async function listWorkerErrors(db: D1Database, before?: number) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const rows = before
    ? await db.prepare('SELECT * FROM worker_errors WHERE id < ?1 AND occurred_at >= ?2 ORDER BY id DESC LIMIT 51')
      .bind(before, cutoff).all<ErrorRow>()
    : await db.prepare('SELECT * FROM worker_errors WHERE occurred_at >= ?1 ORDER BY id DESC LIMIT 51')
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
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  await db.prepare('DELETE FROM worker_errors WHERE occurred_at < ?1').bind(cutoff).run();
}
