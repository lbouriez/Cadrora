import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { D1MaintenanceRepository, GALLERY_CLEANUP_BATCH_SIZE } from '../../../src/server/repositories/maintenanceRepository';
import { registerPortfolioRoutes } from '../../../src/server/routes/portfolio';
import type { AppEnv } from '../../../src/server/types';
import { PortfolioCollectionDetailSchema, PortfolioItemsSchema } from '../../../src/shared/schemas/portfolio';

// Execute real SQL while enforcing the provider's stricter bind limit, which
// ordinary SQLite and query-shaped mocks do not enforce.
function d1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      bind: (...input: SQLInputValue[]) => {
        if (input.length > 100) throw new Error('D1 bound parameter limit exceeded');
        values = input;
        return statement;
      },
      all: () => Promise.resolve({ results: sqlite.prepare(sql).all(...values), success: true }),
      first: () => Promise.resolve(sqlite.prepare(sql).get(...values) ?? null),
      run: () => Promise.resolve({ success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
    };
    return statement;
  };
  return { prepare, batch: (statements: ReturnType<typeof prepare>[]) => Promise.all(statements.map((statement) => statement.run())) } as unknown as D1Database;
}

describe('D1 capacity boundaries', () => {
  it('completes multi-batch gallery cleanup without touching another gallery', async () => {
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec(`
        CREATE TABLE photos (id TEXT PRIMARY KEY, event_id TEXT, import_id TEXT);
        CREATE TABLE photo_variants (photo_id TEXT, variant TEXT, storage_key TEXT);
        CREATE TABLE faces (id TEXT, event_id TEXT, photo_id TEXT, vector_id TEXT, partition_id TEXT);
        CREATE TABLE face_partitions (id TEXT, event_id TEXT);
        CREATE TABLE imports (id TEXT, event_id TEXT);
        CREATE TABLE import_chunks (import_id TEXT, chunk_number INTEGER);
        CREATE TABLE maintenance_jobs (id TEXT, state TEXT, attempts INTEGER, last_error TEXT, available_at TEXT, updated_at TEXT);
        INSERT INTO maintenance_jobs (id) VALUES ('job');
        INSERT INTO imports VALUES ('import', 'target'), ('other-import', 'other');
        INSERT INTO photos VALUES ('other-photo', 'other', 'other-import');
        INSERT INTO photo_variants VALUES ('other-photo', 'thumb', 'other-key');
        INSERT INTO import_chunks VALUES ('other-import', 0);
      `);
      for (let i = 0; i < 120; i += 1) {
        sqlite.prepare('INSERT INTO photos VALUES (?, ?, ?)').run(`photo-${i}`, 'target', 'import');
        sqlite.prepare('INSERT INTO photo_variants VALUES (?, ?, ?)').run(`photo-${i}`, 'thumb', `key-${i}`);
        sqlite.prepare('INSERT INTO faces VALUES (?, ?, ?, ?, ?)').run(`face-${i}`, 'target', `photo-${i}`, `vector-${i}`, `partition-${i}`);
        sqlite.prepare('INSERT INTO face_partitions VALUES (?, ?)').run(`partition-${i}`, 'target');
        sqlite.prepare('INSERT INTO import_chunks VALUES (?, ?)').run('import', i);
      }
      const repository = new D1MaintenanceRepository(d1(sqlite));
      const seen = new Set<string>();
      for (let iteration = 0; iteration < 30; iteration += 1) {
        const batch = await repository.galleryCleanupBatch('target');
        if (batch.kind === 'complete') break;
        seen.add(batch.kind);
        const size = 'rows' in batch ? batch.rows.length : batch.ids.length;
        expect(size).toBeLessThanOrEqual(GALLERY_CLEANUP_BATCH_SIZE);
        await repository.completeGalleryCleanupBatch('job', 'target', batch, '2030-01-01T00:00:00.000Z');
      }
      expect(await repository.galleryCleanupBatch('target')).toEqual({ kind: 'complete' });
      expect([...seen].sort()).toEqual(['chunks', 'faces', 'imports', 'media', 'partitions', 'photos']);
      expect(sqlite.prepare('SELECT storage_key FROM photo_variants').all()).toEqual([{ storage_key: 'other-key' }]);
      expect(sqlite.prepare('SELECT import_id FROM import_chunks').all()).toEqual([{ import_id: 'other-import' }]);
    } finally { sqlite.close(); }
  });

  it('reconciles gallery, service and portfolio storage idempotently', async () => {
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec(`
        CREATE TABLE photo_variants (byte_size INTEGER);
        CREATE TABLE site_service_variants (byte_size INTEGER);
        CREATE TABLE portfolio_variants (byte_size INTEGER);
        CREATE TABLE faces (id TEXT);
        CREATE TABLE usage_counters (key TEXT PRIMARY KEY, value INTEGER, updated_at TEXT);
        INSERT INTO photo_variants VALUES (100), (200);
        INSERT INTO site_service_variants VALUES (40);
        INSERT INTO portfolio_variants VALUES (500), (60);
        INSERT INTO usage_counters VALUES ('storage_bytes', 1, 'old');
      `);
      const repository = new D1MaintenanceRepository(d1(sqlite));
      for (let pass = 0; pass < 2; pass += 1) await repository.reconcileUsage('2030-01-01T00:00:00.000Z');
      expect(sqlite.prepare("SELECT value FROM usage_counters WHERE key = 'storage_bytes'").get()).toEqual({ value: 900 });
      sqlite.exec('DELETE FROM portfolio_variants WHERE byte_size = 500');
      await repository.reconcileUsage('2030-01-02T00:00:00.000Z');
      expect(sqlite.prepare("SELECT value FROM usage_counters WHERE key = 'storage_bytes'").get()).toEqual({ value: 400 });
    } finally { sqlite.close(); }
  });

  it.each([100, 101, 200])('reads every portfolio image at %i photos through public and admin routes', async (count) => {
    const sqlite = new DatabaseSync(':memory:');
    try {
      sqlite.exec(`
        CREATE TABLE portfolio_collections (id TEXT, slug TEXT, category_id TEXT, copy_json TEXT, sort_order INTEGER, published INTEGER, cover_photo_id TEXT);
        CREATE TABLE portfolio_photos (id TEXT, collection_id TEXT, alt_json TEXT, sort_order INTEGER, state TEXT);
        CREATE TABLE portfolio_variants (photo_id TEXT, variant TEXT, storage_key TEXT, content_type TEXT, byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT);
      `);
      sqlite.prepare('INSERT INTO portfolio_collections VALUES (?, ?, ?, ?, ?, ?, ?)').run('collection', 'weddings', 'wedding',
        JSON.stringify({ fr: { title: 'Mariages', description: '' }, en: { title: 'Weddings', description: '' } }), 0, 1, 'photo-0');
      for (let i = 0; i < count; i += 1) {
        sqlite.prepare('INSERT INTO portfolio_photos VALUES (?, ?, ?, ?, ?)').run(`photo-${i}`, 'collection', '{"fr":"Photo","en":"Photo"}', i, 'published');
        sqlite.prepare('INSERT INTO portfolio_variants VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`photo-${i}`, 'small', `key-${i}`, 'image/jpeg', 100, 640, 480, 'sha');
      }
      const app = new Hono<AppEnv>();
      app.use('*', async (context, next) => {
        context.set('auth', { admin: { access: 'manage', authMode: 'password', id: 'owner', subject: 'owner',
          createdAt: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-02T00:00:00.000Z', revokedAt: null } });
        await next();
      });
      registerPortfolioRoutes(app);
      for (const path of ['/api/v1/portfolio/weddings', '/api/v1/admin/portfolio']) {
        const response = await app.request(path, {}, { DB: d1(sqlite) });
        expect(response.status).toBe(200);
        const body: unknown = await response.json();
        const photos = path.includes('/admin/') ? PortfolioItemsSchema.parse(body) : PortfolioCollectionDetailSchema.parse(body).photos;
        expect(photos).toHaveLength(count);
        expect(photos.every((photo) => photo.imageSources.length === 1)).toBe(true);
        expect(photos.at(-1)?.id).toBe(`photo-${count - 1}`);
      }
    } finally { sqlite.close(); }
  });
});
