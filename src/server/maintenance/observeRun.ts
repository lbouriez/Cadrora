import { recordAppLog } from '../services/appLog';

/** Telemetry failure never prevents cleanup; each invocation has its own row. */
export async function observeMaintenanceRun(db: D1Database, work: () => Promise<number>, now = () => new Date()): Promise<void> {
  const id = crypto.randomUUID();
  const save = async (statement: D1PreparedStatement) => {
    try { await statement.run(); } catch { console.warn('cadrora_maintenance_status_unavailable'); }
  };
  // Preparing a statement can itself fail on an unavailable/missing binding.
  try {
    await save(db.prepare("INSERT INTO maintenance_runs (id, started_at, state) VALUES (?, ?, 'running')").bind(id, now().toISOString()));
  } catch { console.warn('cadrora_maintenance_status_unavailable'); }
  let processed = 0;
  let state: 'completed' | 'failed' = 'failed';
  try {
    processed = await work();
    state = 'completed';
  } finally {
    try {
      await save(db.prepare('UPDATE maintenance_runs SET state = ?, finished_at = ?, processed = ? WHERE id = ?')
        .bind(state, now().toISOString(), processed, id));
    } catch { console.warn('cadrora_maintenance_status_unavailable'); }
    await recordAppLog(db, { level: state === 'completed' ? 'info' : 'error', source: 'scheduler',
      code: state === 'completed' ? 'MAINTENANCE_RUN_COMPLETED' : 'MAINTENANCE_RUN_FAILED', category: 'scheduler',
      requestId: id, method: 'SCHEDULED', routeGroup: 'maintenance' }, now());
  }
}
