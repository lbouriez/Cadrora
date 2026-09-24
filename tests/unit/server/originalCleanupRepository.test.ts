import { describe, expect, it, vi } from 'vitest';

import { D1MaintenanceRepository } from '../../../src/server/repositories/maintenanceRepository';

function database(allowDownloads: number, keepOriginals: number) {
  const queries: string[] = [];
  const batch = vi.fn().mockResolvedValue([]);
  const prepare = vi.fn((sql: string) => {
    queries.push(sql);
    const statement = {
      bind: vi.fn().mockImplementation(() => statement),
      first: vi.fn().mockResolvedValue({ allow_downloads: allowDownloads, keep_originals: keepOriginals, deleting_at: null }),
      all: vi.fn().mockResolvedValue({ results: [{ photo_id: 'photo-1', storage_key: 'events/gallery-1/photos/photo-1/0/original.png' }] }),
    };
    return statement;
  });
  return { batch, db: { batch, prepare } as unknown as D1Database, queries };
}

describe('original-only maintenance repository', () => {
  it('loads bounded D1-derived original keys and removes only matching original rows after R2 deletion', async () => {
    const { batch, db, queries } = database(1, 0);
    const repository = new D1MaintenanceRepository(db);
    const result = await repository.originalCleanupBatch('gallery-1');
    expect(result).toEqual({ shouldDelete: true, rows: [{
      photoId: 'photo-1', storageKey: 'events/gallery-1/photos/photo-1/0/original.png',
    }] });
    expect(queries.some((sql) => sql.includes("v.variant = 'original'") && sql.includes('LIMIT 100'))).toBe(true);
    await repository.completeOriginalCleanupBatch('job-1', result.rows, '2030-01-01T00:00:00.000Z');
    expect(batch).toHaveBeenCalledOnce();
    expect(queries.some((sql) => sql.includes("DELETE FROM photo_variants WHERE photo_id = ?1 AND variant = 'original' AND storage_key = ?2"))).toBe(true);
    expect(queries.some((sql) => sql.includes('DELETE FROM photos'))).toBe(false);
  });

  it('does not select any keys when original delivery was re-enabled', async () => {
    const { db, queries } = database(1, 1);
    const repository = new D1MaintenanceRepository(db);
    await expect(repository.originalCleanupBatch('gallery-1')).resolves.toEqual({ shouldDelete: false, rows: [] });
    expect(queries.some((sql) => sql.includes("v.variant = 'original'"))).toBe(false);
  });
});
