import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordAppLog, listAppLogs, purgeAppHistory } from '../../../src/server/services/appLog';
import { listMaintenanceJobs, maintenanceOverview } from '../../../src/server/services/maintenanceStatus';
import { observeMaintenanceRun } from '../../../src/server/maintenance/observeRun';
import { registerMaintenanceRoutes } from '../../../src/server/routes/admin/maintenance';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { listWorkerErrors } from '../../../src/server/services/workerErrorLog';
import type { AppEnv } from '../../../src/server/types';
import type { AppLogInput } from '../../../src/shared/schemas/maintenance';

function database(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      bind: (...input: SQLInputValue[]) => { if (input.length > 100) throw new Error('Too many parameters'); values = input; return statement; },
      all: () => Promise.resolve({ results: sqlite.prepare(sql).all(...values), success: true }),
      first: () => Promise.resolve(sqlite.prepare(sql).get(...values) ?? null),
      run: () => Promise.resolve({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
    };
    return statement;
  };
  return { prepare, batch: (items: ReturnType<typeof prepare>[]) => Promise.all(items.map((item) => item.run())) } as unknown as D1Database;
}

const now = new Date('2030-04-01T00:00:00.000Z');
const event: AppLogInput = { level: 'error', source: 'http', code: 'INTERNAL_ERROR', category: 'unexpected',
  requestId: 'req-safe', method: 'GET', routeGroup: 'gallery-api' };
let sqlite: DatabaseSync;
let db: D1Database;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync('migrations').filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`migrations/${name}`, 'utf8'));
  db = database(sqlite);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); });

describe('maintenance observability', () => {
  it('upgrades existing error rows without changing their identifiers or content', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      legacy.exec(readFileSync('migrations/035_worker_error_log.sql', 'utf8'));
      legacy.exec("CREATE TABLE maintenance_jobs (id TEXT, state TEXT, created_at TEXT)");
      legacy.exec("INSERT INTO worker_errors VALUES (73, '2030-01-01T00:00:00.000Z', 'legacy-request', 'GET', 'admin-api', 'INTERNAL_ERROR', 'unexpected')");
      legacy.exec(readFileSync('migrations/046_maintenance_observability.sql', 'utf8'));
      expect(legacy.prepare('SELECT id, request_id, level, source, job_id FROM worker_errors').get()).toEqual({
        id: 73, request_id: 'legacy-request', level: 'error', source: 'http', job_id: null,
      });
    } finally { legacy.close(); }
  });

  it('preserves legacy HTTP errors and filters/paginates structured events without leaking metadata', async () => {
    for (let i = 0; i < 53; i++) await recordAppLog(db, event, now);
    await recordAppLog(db, { ...event, level: 'info', source: 'scheduler', code: 'MAINTENANCE_RUN_COMPLETED', category: 'scheduler' }, now);
    await recordAppLog(db, { ...event, message: 'private raw exception' } as AppLogInput, now);
    await recordAppLog(db, { ...event, code: 'SECRET / private.jpg' }, now);
    const first = await listAppLogs(db, { level: 'error', source: 'http' }, now);
    const second = await listAppLogs(db, { level: 'error', source: 'http', before: first.nextBefore! }, now);
    expect(first.logs).toHaveLength(50);
    expect(second.logs).toHaveLength(3);
    expect(new Set([...first.logs, ...second.logs].map((row) => row.id)).size).toBe(53);
    expect(second.nextBefore).toBeNull();
    expect(JSON.stringify(first)).not.toContain('private');
    expect((await listAppLogs(db, { source: 'scheduler' }, now)).logs).toHaveLength(1);
    // Old endpoint deliberately excludes scheduler/application information.
    expect((await listWorkerErrors(db)).errors.every((row) => row.code === 'INTERNAL_ERROR')).toBe(true);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM worker_errors').get()?.n).toBe(54);
  });

  it('hides expired logs immediately and drains retained history in bounded batches without deleting jobs', async () => {
    const insert = sqlite.prepare('INSERT INTO worker_errors (occurred_at, request_id, method, route_group, code, category) VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < 1002; i++) insert.run('2029-01-01T00:00:00.000Z', `old-${i}`, 'GET', 'other', 'INTERNAL_ERROR', 'unexpected');
    await recordAppLog(db, event, now);
    sqlite.exec("INSERT INTO maintenance_runs VALUES ('old', '2029-01-01T00:00:00.000Z', NULL, 'running', 0)");
    addJob('keep-job', 'failed');
    expect((await listAppLogs(db, {}, now)).logs).toHaveLength(1);
    await purgeAppHistory(db, now);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM worker_errors').get()?.n).toBe(3);
    await purgeAppHistory(db, now);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM worker_errors').get()?.n).toBe(1);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM maintenance_runs').get()?.n).toBe(0);
    expect(sqlite.prepare('SELECT id FROM maintenance_jobs').get()?.id).toBe('keep-job');
  });

  it('shows unknown scheduling and real job states without exposing raw failures or payloads', async () => {
    addJob('failed', 'failed'); addJob('stale', 'running'); addJob('pending', 'pending'); addJob('done', 'completed');
    const overview = await maintenanceOverview(db, now);
    expect(overview.lastRun).toBeNull(); expect(overview.lastSuccessAt).toBeNull();
    expect(overview.counts).toEqual({ pending: 1, running: 1, failed: 1, completed: 1, staleRunning: 1 });
    const page = await listMaintenanceJobs(db, { state: 'active' }, now);
    expect(page.jobs).toHaveLength(3);
    expect(page.jobs.find((job) => job.id === 'stale')?.leaseExpired).toBe(true);
    expect(page.jobs.every((job) => job.hasError)).toBe(true);
    expect(JSON.stringify(page)).not.toContain('secret');
    expect(JSON.stringify(page)).not.toContain('storageKeys');
  });

  it('paginates jobs sharing a timestamp without gaps, and keeps completed jobs separate', async () => {
    for (let i = 0; i < 55; i++) addJob(`job-${String(i).padStart(3, '0')}`, 'pending');
    addJob('completed', 'completed');
    const first = await listMaintenanceJobs(db, { state: 'pending' }, now);
    const second = await listMaintenanceJobs(db, { state: 'pending', beforeCreatedAt: first.nextCursor!.createdAt, beforeId: first.nextCursor!.id }, now);
    expect(first.jobs).toHaveLength(50); expect(second.jobs).toHaveLength(5);
    expect(new Set([...first.jobs, ...second.jobs].map((job) => job.id)).size).toBe(55);
    expect((await listMaintenanceJobs(db, { state: 'completed' }, now)).jobs.map((job) => job.id)).toEqual(['completed']);
  });

  it('records separate successful and failed runs, without persisting provider exceptions', async () => {
    await observeMaintenanceRun(db, () => Promise.resolve(7), () => now);
    const failureTime = new Date(now.getTime() + 15 * 60_000);
    await expect(observeMaintenanceRun(db, () => Promise.reject(new Error('secret provider key')), () => failureTime)).rejects.toThrow('secret provider key');
    const summary = await maintenanceOverview(db, failureTime);
    expect(summary.lastRun?.state).toBe('failed');
    expect(summary.lastSuccessAt).toBe(now.toISOString());
    const history = await listAppLogs(db, { source: 'scheduler' }, failureTime);
    expect(history.logs.map((row) => row.code)).toEqual(['MAINTENANCE_RUN_FAILED', 'MAINTENANCE_RUN_COMPLETED']);
    expect(JSON.stringify(history)).not.toContain('secret');
  });

  it('continues the maintenance work and preserves original errors when telemetry storage is unavailable', async () => {
    const unavailable = { prepare: () => { throw new Error('private D1 details'); } } as unknown as D1Database;
    const work = vi.fn(() => Promise.resolve(1));
    await observeMaintenanceRun(unavailable, work, () => now);
    expect(work).toHaveBeenCalledOnce();
    await expect(recordAppLog(unavailable, event, now)).resolves.toBeUndefined();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private D1');
  });

  it.each([undefined, 'read-only', 'manage'] as const)('enforces owner access and validates filters for %s', async (access) => {
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('requestId', 'req-test');
      context.set('auth', access ? { admin: { id: 'admin', subject: 'owner', access, authMode: 'password',
        createdAt: now.toISOString(), expiresAt: '2031-01-01T00:00:00.000Z', revokedAt: null } } : {});
      await next();
    });
    app.onError(errorBoundary);
    registerMaintenanceRoutes(app);
    for (const section of ['overview', 'jobs', 'logs']) {
      const response = await app.request(`/api/v1/admin/maintenance/${section}`, {}, { DB: db });
      expect(response.status).toBe(access === 'manage' ? 200 : access ? 403 : 401);
      if (access === 'manage') expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    if (access === 'manage') {
      for (const path of ['logs?level=secret', 'jobs?beforeId=alone', 'overview?extra=1', 'logs?before=-1']) {
        expect((await app.request(`/api/v1/admin/maintenance/${path}`, {}, { DB: db })).status).toBe(400);
      }
    }
  });
});

function addJob(id: string, state: string) {
  sqlite.prepare(`INSERT INTO maintenance_jobs (id, kind, state, payload_json, attempts, available_at, created_at, updated_at, last_error, idempotency_key)
    VALUES (?, 'delete_photo_media', ?, ?, 2, ?, ?, ?, 'secret exception', ?)`)
    .run(id, state, '{"storageKeys":["secret"]}', now.toISOString(), '2030-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', id);
}
