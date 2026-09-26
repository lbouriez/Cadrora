import { describe, expect, it, vi } from 'vitest';

import { galleryCachePurgeStatement, tryImmediateGalleryCachePurge } from '../../../src/server/services/galleryCachePurge';

describe('gallery cache purge outbox', () => {
  it('keeps a delayed second purge pending after an immediate successful purge', async () => {
    const bound: unknown[][] = [];
    const preparedSql: string[] = [];
    const prepare = vi.fn((sql: string) => {
      preparedSql.push(sql);
      const statement = {
        bind: vi.fn((...values: unknown[]) => {
          bound.push(values);
          return statement;
        }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      };
      return statement;
    });
    const database = { prepare } as unknown as D1Database;
    const now = '2030-01-01T00:00:00.000Z';
    const { jobId } = galleryCachePurgeStatement(database, 'gallery-1', now);

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("'purge_gallery_cache'"));
    expect(preparedSql[0]).toContain('0, ?4, ?5, ?5)');
    expect(bound[0]).toEqual([
      jobId,
      JSON.stringify({ eventId: 'gallery-1' }),
      `purge-gallery-cache:${jobId}`,
      '2030-01-01T00:05:00.000Z',
      now,
    ]);

    const purgeGallery = vi.fn().mockResolvedValue(undefined);
    await tryImmediateGalleryCachePurge(database, { exports: { PublicMediaCache: { purgeGallery } } }, 'gallery-1', jobId, now);
    expect(purgeGallery).toHaveBeenCalledWith('gallery-1');
    expect(prepare).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id = ?1 AND state = 'pending'"));
    expect(preparedSql[1]).not.toContain("state = 'completed'");
  });
});
