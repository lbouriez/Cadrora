import { MediaDiagnosticPageSchema, type MediaDiagnosticScopeSchema } from '../../shared/schemas/mediaDiagnostics';
import type { z } from '../../shared/zod';

type Scope = z.infer<typeof MediaDiagnosticScopeSchema>;
const SCOPE_TABLE: Record<Scope, { prefix: string; table: string }> = {
  galleries: { prefix: 'events/', table: 'photo_variants' },
  services: { prefix: 'site/services/', table: 'site_service_variants' },
  portfolio: { prefix: 'site/portfolio/', table: 'portfolio_variants' },
};
const PAGE_SIZE = 100;
const UPLOAD_GRACE_MS = 15 * 60_000;

/** Read-only, bounded inventory. Untracked objects require operator review, never automatic deletion. */
export async function scanMediaObjects(db: D1Database, bucket: R2Bucket, scope: Scope, cursor?: string, now = new Date()) {
  const { prefix, table } = SCOPE_TABLE[scope];
  const page = await bucket.list({ prefix, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
  const cutoff = now.getTime() - UPLOAD_GRACE_MS;
  const oldObjects = page.objects.filter((object) => object.uploaded.getTime() < cutoff);
  const keys = oldObjects.map((object) => object.key);
  const recorded = keys.length === 0 ? [] : (await db.prepare(
    `SELECT storage_key FROM ${table} WHERE storage_key IN (${keys.map(() => '?').join(',')})`,
  ).bind(...keys).all<{ storage_key: string }>()).results;
  const known = new Set(recorded.map((row) => row.storage_key));
  const jobs = await db.prepare(`SELECT state, COUNT(*) AS total FROM maintenance_jobs
    WHERE kind LIKE 'delete_%' AND state IN ('pending', 'running', 'failed') GROUP BY state`)
    .all<{ state: string; total: number }>();
  const count = (state: string) => jobs.results.find((row) => row.state === state)?.total ?? 0;
  return MediaDiagnosticPageSchema.parse({
    scanned: page.objects.length,
    untracked: oldObjects.filter((object) => !known.has(object.key))
      .map((object) => ({ key: object.key, uploadedAt: object.uploaded.toISOString() })),
    nextCursor: page.truncated ? page.cursor : null,
    pendingCleanupJobs: count('pending'),
    runningCleanupJobs: count('running'),
    failedCleanupJobs: count('failed'),
  });
}
