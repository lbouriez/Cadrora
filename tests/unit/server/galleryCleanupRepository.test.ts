import { describe, expect, it, vi } from 'vitest';

import {
  D1MaintenanceRepository,
  GALLERY_CLEANUP_BATCH_SIZE,
} from '../../../src/server/repositories/maintenanceRepository';

describe('gallery deletion repository', () => {
  it('selects only one bounded provider batch from D1', async () => {
    const rows = Array.from({ length: GALLERY_CLEANUP_BATCH_SIZE }, (_, index) => ({
      photo_id: `photo-${index}`, variant: 'small', storage_key: `events/gallery/photos/photo-${index}/0/small.webp`,
    }));
    const statement = {
      bind: vi.fn(), all: vi.fn().mockResolvedValue({ results: rows }),
    };
    statement.bind.mockReturnValue(statement);
    const prepare = vi.fn().mockReturnValue(statement);
    const db = { prepare } as unknown as D1Database;
    const repository = new D1MaintenanceRepository(db);

    const batch = await repository.galleryCleanupBatch('gallery');
    expect(batch.kind).toBe('media');
    expect(batch.kind === 'media' ? batch.rows : []).toHaveLength(GALLERY_CLEANUP_BATCH_SIZE);
    expect(statement.bind).toHaveBeenCalledWith('gallery', GALLERY_CLEANUP_BATCH_SIZE);
    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0]?.[0]).toContain('LIMIT ?2');
  });

  it('deletes only acknowledged keys and requeues the same job in one D1 batch', async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    const batchSpy = vi.fn().mockResolvedValue([]);
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...values: unknown[]) => {
          const record = { sql, values };
          statements.push(record);
          return record;
        },
      })),
      batch: batchSpy,
    } as unknown as D1Database;
    const repository = new D1MaintenanceRepository(db);

    await repository.completeGalleryCleanupBatch('job-1', 'gallery', {
      kind: 'media', rows: [{ photoId: 'photo-1', variant: 'small', storageKey: 'events/gallery/photos/photo-1/0/small.webp' }],
    }, '2030-01-01T00:00:00.000Z');

    expect(statements).toHaveLength(2);
    expect(statements[0]?.sql).toContain('DELETE FROM photo_variants');
    expect(statements[0]?.sql).toContain('photo_id IN (SELECT id FROM photos WHERE event_id = ?1)');
    expect(statements[0]?.values).toEqual(['gallery', 'events/gallery/photos/photo-1/0/small.webp']);
    expect(statements[1]?.sql).toContain("state = 'pending'");
    expect(batchSpy).toHaveBeenCalledOnce();
  });

  it('cleans import chunks before imports in bounded batches', async () => {
    const queries: string[] = [];
    const resultSets = [[], [], [], [], [{ import_id: 'import-1', chunk_number: 3 }]];
    const db = {
      prepare: vi.fn((sql: string) => {
        queries.push(sql);
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: resultSets.shift() ?? [] }),
          }),
        };
      }),
    } as unknown as D1Database;
    const batch = await new D1MaintenanceRepository(db).galleryCleanupBatch('gallery');
    expect(batch).toEqual({ kind: 'chunks', rows: [{ importId: 'import-1', chunkNumber: 3 }] });
    expect(queries.at(-1)).toContain('FROM import_chunks ic');
    expect(queries.at(-1)).toContain('LIMIT ?2');
    expect(queries.some((sql) => sql.includes('SELECT id FROM imports'))).toBe(false);
  });

  it('rejects an oversized acknowledgement before changing D1', async () => {
    const batchSpy = vi.fn();
    const db = { prepare: vi.fn(), batch: batchSpy } as unknown as D1Database;
    const repository = new D1MaintenanceRepository(db);
    await expect(repository.completeGalleryCleanupBatch('job-1', 'gallery', {
      kind: 'photos', ids: Array.from({ length: GALLERY_CLEANUP_BATCH_SIZE + 1 }, (_, index) => `photo-${index}`),
    }, '2030-01-01T00:00:00.000Z')).rejects.toThrow('Invalid gallery cleanup batch size');
    expect(batchSpy).not.toHaveBeenCalled();
  });
});
