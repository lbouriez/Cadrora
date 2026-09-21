import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { FaceSearchRepository } from '../../../src/server/repositories/faceSearchRepository';
import { D1FaceSearchRepository } from '../../../src/server/repositories/faceSearchRepository';
import { enqueueExpiredFacePurges, registerFaceSearchRoutes } from '../../../src/server/routes/faceSearch';
import { signFaceSearchCursor, verifyFaceSearchCursor } from '../../../src/server/routes/faceSearchCursor';
import { CloudflareFaceVectorService, faceNamespace } from '../../../src/server/services/faceVectorSearch';
import type { FaceVectorService } from '../../../src/server/services/faceVectorSearch';
import type { AppEnv } from '../../../src/server/types';

function repository(overrides: Partial<FaceSearchRepository> = {}): FaceSearchRepository {
  return {
    currentGeneration: vi.fn().mockResolvedValue(1),
    enqueuePurge: vi.fn().mockResolvedValue(true),
    partitions: vi.fn().mockResolvedValue([]),
    recordVectorQuery: vi.fn().mockResolvedValue(undefined),
    related: vi.fn().mockResolvedValue([]),
    resultsForMatches: vi.fn().mockResolvedValue([]),
    upsertPhotoFaces: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

const eventRow = {
  id: 'event-1', slug: 'event-one', title: 'Event', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'public', allow_downloads: 0, face_search_enabled: 1, nearby_search_enabled: 1, show_photo_metadata: 0,
  keep_originals: 0, retention_days: 30, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

function databaseForEvent(row = eventRow): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(row) }),
    }),
  } as unknown as D1Database;
}

describe('face search privacy and pagination', () => {
  it('blocks nearby moments when that gallery option is disabled', async () => {
    const related = vi.fn().mockResolvedValue([]);
    const faceRepository = repository({ related });
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', async (context, next) => { context.set('auth', {}); await next(); });
    registerFaceSearchRoutes(app, {
      now: () => '2030-02-01T00:00:00.000Z',
      repository: () => faceRepository,
      vectors: () => ({ available: () => true, delete: vi.fn(), query: vi.fn(), upsert: vi.fn() }),
    });

    const response = await app.request(
      '/api/v1/events/event-1/photos/photo-1/related',
      {},
      { DB: databaseForEvent({ ...eventRow, nearby_search_enabled: 0 }) },
    );

    expect(response.status).toBe(409);
    expect(related).not.toHaveBeenCalled();
  });

  it('signs domain-scoped cursors and rejects tampering or a missing secret', async () => {
    const payload = { eventId: 'event-1', generation: 2, nextPartition: 3 };
    const cursor = await signFaceSearchCursor(payload, 'test-secret');
    await expect(verifyFaceSearchCursor(cursor, 'test-secret')).resolves.toEqual(payload);
    await expect(verifyFaceSearchCursor(`${cursor}x`, 'test-secret')).rejects.toThrow('errors.invalidCursor');
    await expect(signFaceSearchCursor(payload)).rejects.toThrow('errors.faceSearchUnavailable');
  });

  it('uses namespace isolation, only partition metadata, and the cosine threshold', async () => {
    const query = vi.fn().mockResolvedValue({
      count: 2,
      matches: [
        { id: 'vector-pass', score: 0.4 },
        { id: 'vector-reject', score: 0.3 },
      ],
    });
    const service = new CloudflareFaceVectorService({ query } as unknown as VectorizeIndex);
    const result = await service.query(Array.from({ length: 128 }, () => 0.1), 'event-1', 4, 'partition-2');
    expect(result).toEqual({ saturated: false, matches: [{ vectorId: 'vector-pass', score: 0.4 }] });
    expect(query).toHaveBeenCalledWith(expect.any(Array), {
      topK: 100,
      namespace: faceNamespace('event-1', 4),
      returnMetadata: 'none',
      returnValues: false,
      filter: { partition_id: 'partition-2' },
    });
  });

  it('binds matched vector IDs to D1 without mixing numbered and anonymous placeholders', async () => {
    const bind = vi.fn();
    const statement = {
      all: vi.fn().mockResolvedValue({ results: [{
        captured_at: '2030-01-01T00:00:00.000Z',
        moment_id: 'arrival',
        photo_id: 'photo-1',
        revision: 2,
        vector_id: 'vector-1',
      }] }),
      bind,
    };
    bind.mockReturnValue(statement);
    const prepare = vi.fn().mockReturnValue(statement);
    const faceRepository = new D1FaceSearchRepository({ prepare } as unknown as D1Database);

    await expect(faceRepository.resultsForMatches('event-1', [
      { score: 0.8, vectorId: 'vector-1' },
      { score: 0.7, vectorId: 'vector-2' },
    ], '2030-01-02T00:00:00.000Z')).resolves.toEqual([expect.objectContaining({
      photoId: 'photo-1',
      score: 0.8,
    })]);

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('p.event_id = ?'));
    expect(prepare.mock.calls[0]?.[0]).not.toContain('?1');
    expect(bind).toHaveBeenCalledWith(
      'event-1',
      'vector-1',
      'vector-2',
      '2030-01-02T00:00:00.000Z',
    );
  });

  it('blocks search immediately when no unexpired generation remains', async () => {
    const faceRepository = repository({ currentGeneration: vi.fn().mockResolvedValue(null) });
    const query = vi.fn();
    const vectors: FaceVectorService = {
      available: () => true,
      delete: vi.fn(),
      query,
      upsert: vi.fn(),
    };
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', async (context, next) => { context.set('auth', {}); await next(); });
    registerFaceSearchRoutes(app, {
      now: () => '2030-02-01T00:00:00.000Z',
      repository: () => faceRepository,
      vectors: () => vectors,
    });
    const response = await app.request('/api/v1/events/event-1/face-search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding: Array.from({ length: 128 }, () => 0.1) }),
    }, { DB: databaseForEvent(), TURNSTILE_SECRET_KEY: 'test-secret' });
    expect(response.status).toBe(410);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows an idempotent retry at quota but rejects expiry beyond event retention', async () => {
    const statements: string[] = [];
    const database = {
      prepare: vi.fn((sql: string) => {
        statements.push(sql);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(() => {
            if (sql.includes('FROM photos p JOIN events')) return Promise.resolve({
              event_id: 'event-1', face_search_enabled: 1, retention_days: 10,
              starts_at: '2030-01-01T00:00:00.000Z',
            });
            if (sql.includes('COUNT(*)')) return Promise.resolve({ count: 100 });
            if (sql.includes('SELECT 1 AS found')) return Promise.resolve({ found: 1 });
            if (sql.includes('FROM faces f JOIN face_partitions')) return Promise.resolve({
              id: 'face-fixed', partition_id: 'partition-1', vector_id: 'vector-fixed', generation: 1,
              expires_at: '2030-01-10T00:00:00.000Z',
            });
            if (sql.includes('SELECT 1 AS owned FROM photos')) return Promise.resolve({ owned: 1 });
            return Promise.resolve(null);
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const faceRepository = new D1FaceSearchRepository(database);
    const vectors: FaceVectorService = { available: () => true, delete: vi.fn(), query: vi.fn(), upsert: vi.fn() };
    const base = {
      modelId: 'sface-2021dec', generation: 1,
      faces: [{ faceNumber: 0, embedding: Array.from({ length: 128 }, () => 0.1) }],
    };
    await expect(faceRepository.upsertPhotoFaces(
      'photo-1', { ...base, expiresAt: '2030-01-10T00:00:00.000Z' }, vectors,
      '2030-01-02T00:00:00.000Z', 100,
    )).resolves.toBe(1);
    await expect(faceRepository.upsertPhotoFaces(
      'photo-1', { ...base, expiresAt: '2030-01-09T00:00:00.000Z' }, vectors,
      '2030-01-02T00:00:00.000Z', 100,
    )).rejects.toThrow('FACE_EXPIRY_IMMUTABLE');
    await expect(faceRepository.upsertPhotoFaces(
      'photo-1', { ...base, expiresAt: '2030-01-12T00:00:00.000Z' }, vectors,
      '2030-01-02T00:00:00.000Z', 100,
    )).rejects.toThrow('FACE_EXPIRY_EXCEEDS_RETENTION');
    expect(statements.some((sql) => sql.includes('SELECT 1 AS found'))).toBe(true);
  });

  it('queues a cutoff-scoped cleanup for individually expired vectors', async () => {
    const insertedBindings: unknown[][] = [];
    const database = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          all: vi.fn().mockResolvedValue({ results: [{ event_id: 'event-1' }] }),
          bind: vi.fn((...values: unknown[]) => {
            if (sql.includes('INSERT INTO maintenance_jobs')) insertedBindings.push(values);
            return statement;
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const cutoff = '2030-01-01T00:00:00.000Z';

    await expect(enqueueExpiredFacePurges(database, cutoff)).resolves.toBe(1);
    expect(insertedBindings).toHaveLength(1);
    expect(JSON.parse(String(insertedBindings[0]?.[1]))).toEqual({
      eventId: 'event-1',
      expiresBefore: cutoff,
    });
  });

  it('records new face intent in D1 before mutating Vectorize', async () => {
    const operations: string[] = [];
    const database = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(() => {
            if (sql.includes('FROM photos p JOIN events')) return Promise.resolve({
              event_id: 'event-1', face_search_enabled: 1, retention_days: null,
              starts_at: '2030-01-01T00:00:00.000Z',
            });
            if (sql.includes('COUNT(*)')) return Promise.resolve({ count: 0 });
            if (sql.includes('SELECT id FROM face_partitions')) return Promise.resolve({ id: 'partition-1' });
            if (sql.includes('SELECT 1 AS owned FROM photos')) return Promise.resolve({ owned: 1 });
            return Promise.resolve(null);
          }),
          run: vi.fn().mockImplementation(() => {
            if (sql.includes('INSERT INTO faces ')) operations.push('d1-face');
            return Promise.resolve({ meta: { changes: 1 } });
          }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const vectors: FaceVectorService = {
      available: () => true,
      delete: vi.fn(),
      query: vi.fn(),
      upsert: vi.fn().mockImplementation(() => {
        operations.push('vector');
        return Promise.resolve();
      }),
    };
    const faceRepository = new D1FaceSearchRepository(database);

    await expect(faceRepository.upsertPhotoFaces(
      'photo-1',
      {
        expiresAt: '2030-01-03T00:00:00.000Z',
        faces: [{ faceNumber: 0, embedding: Array.from({ length: 128 }, () => 0.1) }],
        generation: 1,
        modelId: 'sface-2021dec',
      },
      vectors,
      '2030-01-02T00:00:00.000Z',
      100,
    )).resolves.toBe(1);
    expect(operations).toEqual(['d1-face', 'vector']);
  });

  it('does not start provider indexing after photo deletion wins the state fence', async () => {
    const database = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(() => {
            if (sql.includes('FROM photos p JOIN events')) return Promise.resolve({
              event_id: 'event-1', face_search_enabled: 1, retention_days: null,
              starts_at: '2030-01-01T00:00:00.000Z',
            });
            if (sql.includes('COUNT(*)')) return Promise.resolve({ count: 0 });
            return Promise.resolve(null);
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const upsert = vi.fn();
    const vectors: FaceVectorService = {
      available: () => true,
      delete: vi.fn(),
      query: vi.fn(),
      upsert,
    };

    await expect(new D1FaceSearchRepository(database).upsertPhotoFaces(
      'photo-1',
      {
        expiresAt: '2030-01-03T00:00:00.000Z',
        faces: [{ faceNumber: 0, embedding: Array.from({ length: 128 }, () => 0.1) }],
        generation: 1,
        modelId: 'sface-2021dec',
      },
      vectors,
      '2030-01-02T00:00:00.000Z',
      100,
    )).rejects.toThrow('PHOTO_FACE_INDEX_UNAVAILABLE');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('compensates a provider upsert when the photo lease is lost immediately afterward', async () => {
    const database = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(() => {
            if (sql.includes('FROM photos p JOIN events')) return Promise.resolve({
              event_id: 'event-1', face_search_enabled: 1, retention_days: null,
              starts_at: '2030-01-01T00:00:00.000Z',
            });
            if (sql.includes('COUNT(*)')) return Promise.resolve({ count: 0 });
            if (sql.includes('SELECT id FROM face_partitions')) return Promise.resolve({ id: 'partition-1' });
            return Promise.resolve(null);
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const deleteVector = vi.fn().mockResolvedValue(undefined);
    const vectors: FaceVectorService = {
      available: () => true,
      delete: deleteVector,
      query: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    };

    await expect(new D1FaceSearchRepository(database).upsertPhotoFaces(
      'photo-1',
      {
        expiresAt: '2030-01-03T00:00:00.000Z',
        faces: [{ faceNumber: 0, embedding: Array.from({ length: 128 }, () => 0.1) }],
        generation: 1,
        modelId: 'sface-2021dec',
      },
      vectors,
      '2030-01-02T00:00:00.000Z',
      100,
    )).rejects.toThrow('PHOTO_FACE_INDEX_UNAVAILABLE');
    expect(deleteVector).toHaveBeenCalledWith(expect.stringContaining('event-1:1:'));
  });
});
