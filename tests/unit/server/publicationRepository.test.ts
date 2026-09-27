import { describe, expect, it, vi } from 'vitest';

import { D1PublicationRepository } from '../../../src/server/repositories/publicationRepository';

describe('publication repository deletion fence', () => {
  it('refuses to republish an offline public gallery while the directory is hidden', async () => {
    const summary = {
      eventId: 'event-1', totalPhotos: 1, readyPhotos: 1, publishedPhotos: 1, indexingPhotos: 0,
      publishedAt: null, visibility: 'published' as const, offlineAt: '2030-01-01T00:00:00.000Z',
    };
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn().mockResolvedValue({ blocked: 1 }),
    };
    const batch = vi.fn();
    const prepare = vi.fn(() => statement);
    const database = { batch, prepare } as unknown as D1Database;
    const publication = new D1PublicationRepository(database);
    vi.spyOn(publication, 'publicationSummary').mockResolvedValue(summary);

    await expect(publication.updatePublication('event-1', 'published', '2030-01-02T00:00:00.000Z'))
      .resolves.toEqual({ status: 'public-disabled' });
    expect(batch).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('s.gallery_directory_enabled = 0'));
  });

  it('allows an existing public gallery to return as Unlisted while the directory is hidden', async () => {
    const offline = {
      eventId: 'event-1', totalPhotos: 1, readyPhotos: 1, publishedPhotos: 1, indexingPhotos: 0,
      publishedAt: null, visibility: 'published' as const, offlineAt: '2030-01-01T00:00:00.000Z',
    };
    const unlisted = { ...offline, visibility: 'unlisted' as const, offlineAt: null };
    const statement = { bind: vi.fn(() => statement) };
    const prepare = vi.fn(() => statement);
    const batch = vi.fn().mockResolvedValue([]);
    const publication = new D1PublicationRepository({ prepare, batch } as unknown as D1Database);
    vi.spyOn(publication, 'publicationSummary').mockResolvedValueOnce(offline).mockResolvedValueOnce(unlisted);

    await expect(publication.updatePublication('event-1', 'unlisted', '2030-01-02T00:00:00.000Z'))
      .resolves.toMatchObject({ status: 'updated', summary: unlisted });
    expect(batch).toHaveBeenCalledOnce();
    expect(prepare).not.toHaveBeenCalledWith(expect.stringContaining('s.gallery_directory_enabled = 0'));
  });

  it('returns zero photo counters for a new empty gallery', async () => {
    let query = '';
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn().mockResolvedValue({
        total_photos: 0, ready_photos: 0, published_photos: 0, indexing_photos: 0,
        published_at: null, visibility: 'draft', offline_at: null,
      }),
    };
    const database = {
      prepare: vi.fn((sql: string) => { query = sql; return statement; }),
    } as unknown as D1Database;

    await expect(new D1PublicationRepository(database).publicationSummary('event-1')).resolves.toMatchObject({
      totalPhotos: 0, readyPhotos: 0, publishedPhotos: 0, indexingPhotos: 0,
    });
    expect(query.match(/COALESCE\(SUM\(/g)).toHaveLength(3);
  });

  it('takes a published gallery offline without changing photo state and revokes guest grants', async () => {
    const statements: string[] = [];
    const bindings: unknown[][] = [];
    const database = {
      batch: vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 1 } }]),
      prepare: vi.fn((sql: string) => {
        statements.push(sql);
        return { bind: vi.fn((...values: unknown[]) => { bindings.push(values); return {}; }) };
      }),
    } as unknown as D1Database;
    const publication = new D1PublicationRepository(database);
    const online = {
      eventId: 'event-1', totalPhotos: 2, readyPhotos: 2, publishedPhotos: 2, indexingPhotos: 0,
      publishedAt: '2030-01-01T00:00:00.000Z', visibility: 'published' as const, offlineAt: null,
    };
    const offline = { ...online, publishedAt: null, offlineAt: '2030-01-02T00:00:00.000Z' };
    vi.spyOn(publication, 'publicationSummary').mockResolvedValueOnce(online).mockResolvedValueOnce(offline);

    const result = await publication.updatePublication('event-1', 'offline', '2030-01-02T00:00:00.000Z');
    expect(result.status).toBe('updated');
    if (result.status === 'updated') {
      expect(result.summary).toEqual(offline);
      expect(typeof result.cachePurgeJobId).toBe('string');
    }

    expect(statements).toEqual(expect.arrayContaining([
      expect.stringContaining('UPDATE events SET offline_at'),
      expect.stringContaining('access_version = access_version + 1'),
      expect.stringContaining("'purge_gallery_cache'"),
    ]));
    expect(statements.some((sql) => sql.includes('UPDATE photos'))).toBe(false);
    expect(bindings).toContainEqual(['event-1', '2030-01-02T00:00:00.000Z']);
  });

  it('does not queue deletion when a live face-indexing lease wins the conditional update', async () => {
    const statements: string[] = [];
    const database = {
      batch: vi.fn().mockResolvedValue([
        { meta: { changes: 0 } },
        { meta: { changes: 0 } },
      ]),
      prepare: vi.fn((sql: string) => {
        statements.push(sql);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn().mockResolvedValue({ event_id: 'event-1', id: 'photo-1' }),
        };
        return statement;
      }),
    } as unknown as D1Database;

    await expect(new D1PublicationRepository(database).deletePhoto(
      'photo-1',
      '2030-01-01T00:00:00.000Z',
    )).resolves.toBe(false);
    expect(statements.some((sql) => sql.includes("face_state <> 'indexing' OR updated_at <= ?3"))).toBe(true);
    expect(statements.some((sql) => sql.includes("state = 'deleting' AND updated_at = ?4"))).toBe(true);
  });
});
