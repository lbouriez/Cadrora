import type { AdminFaceInputSchema, FaceSearchMatch } from '../../shared/schemas';
import type { z } from 'zod';
import type { FaceVectorMatch, FaceVectorService } from '../services/faceVectorSearch';

type AdminFaceInput = z.infer<typeof AdminFaceInputSchema>;

interface PhotoEventRow {
  event_id: string;
  face_search_enabled: number;
  retention_days: number | null;
  starts_at: string;
}

interface ExistingFaceRow {
  expires_at: string | null;
  generation: number;
  id: string;
  partition_id: string;
  vector_id: string;
}

interface PartitionRow {
  id: string;
}

interface SearchPhotoRow {
  photo_id: string;
  revision: number;
  captured_at: string | null;
  moment_id: string | null;
}

export interface RelatedPhoto {
  photoId: string;
  revision: number;
  capturedAt: string | null;
  momentId: string | null;
  thumbnailUrl: string;
}

export interface FaceSearchRepository {
  currentGeneration(eventId: string, now: string): Promise<number | null>;
  enqueuePurge(eventId: string, now: string): Promise<boolean>;
  partitions(eventId: string, generation: number): Promise<string[]>;
  recordVectorQuery(now: string): Promise<void>;
  related(eventId: string, photoId: string): Promise<RelatedPhoto[] | null>;
  resultsForMatches(eventId: string, matches: FaceVectorMatch[], now: string): Promise<FaceSearchMatch[]>;
  upsertPhotoFaces(photoId: string, input: AdminFaceInput, vectors: FaceVectorService, now: string, maxFaces: number): Promise<number>;
}

export class D1FaceSearchRepository implements FaceSearchRepository {
  constructor(private readonly database: D1Database) {}

  async currentGeneration(eventId: string, now: string): Promise<number | null> {
    const row = await this.database.prepare(
      `SELECT MAX(fp.generation) AS generation
       FROM face_partitions fp JOIN faces f ON f.partition_id = fp.id
       WHERE fp.event_id = ?1 AND (f.expires_at IS NULL OR f.expires_at > ?2)`,
    ).bind(eventId, now).first<{ generation: number | null }>();
    return row?.generation ?? null;
  }

  async partitions(eventId: string, generation: number): Promise<string[]> {
    const result = await this.database.prepare(
      'SELECT id FROM face_partitions WHERE event_id = ?1 AND generation = ?2 AND face_count > 0 ORDER BY partition_number ASC',
    ).bind(eventId, generation).all<{ id: string }>();
    return result.results.map((row) => row.id);
  }

  async upsertPhotoFaces(
    photoId: string,
    input: AdminFaceInput,
    vectors: FaceVectorService,
    now: string,
    maxFaces: number,
  ): Promise<number> {
    const photo = await this.database.prepare(
      `SELECT p.event_id, e.face_search_enabled, e.retention_days, e.starts_at
       FROM photos p JOIN events e ON e.id = p.event_id
       WHERE p.id = ?1 AND p.state NOT IN ('deleting', 'deleted')`,
    ).bind(photoId).first<PhotoEventRow>();
    if (!photo) throw new Error('PHOTO_NOT_FOUND');
    if (photo.face_search_enabled !== 1) throw new Error('FACE_SEARCH_DISABLED');
    if (photo.retention_days !== null) {
      const deadline = new Date(Date.parse(photo.starts_at) + photo.retention_days * 86_400_000).toISOString();
      if (input.expiresAt > deadline) throw new Error('FACE_EXPIRY_EXCEEDS_RETENTION');
    }
    const count = await this.database.prepare('SELECT COUNT(*) AS count FROM faces WHERE event_id = ?1')
      .bind(photo.event_id).first<{ count: number }>();
    let newFaces = 0;
    for (const face of input.faces) {
      const exists = await this.database.prepare(
        'SELECT 1 AS found FROM faces WHERE photo_id = ?1 AND face_number = ?2 AND model_id = ?3',
      ).bind(photoId, face.faceNumber, input.modelId).first();
      if (!exists) newFaces += 1;
    }
    if ((count?.count ?? 0) + newFaces > maxFaces) throw new Error('FACE_QUOTA_EXCEEDED');

    const acquired = await this.database.prepare(
      `UPDATE photos
          SET face_state = 'indexing', updated_at = ?2
        WHERE id = ?1
          AND state NOT IN ('deleting', 'deleted')
          AND face_state <> 'deleting'
          AND face_state <> 'indexing'`,
    ).bind(photoId, now).run();
    if ((acquired.meta.changes ?? 0) !== 1) throw new Error('PHOTO_FACE_INDEX_UNAVAILABLE');

    try {
      let indexed = 0;
      for (const face of input.faces) {
        const existing = await this.database.prepare(
          `SELECT f.id, f.partition_id, f.vector_id, f.expires_at, fp.generation
           FROM faces f JOIN face_partitions fp ON fp.id = f.partition_id
           WHERE f.photo_id = ?1 AND f.face_number = ?2 AND f.model_id = ?3`,
        ).bind(photoId, face.faceNumber, input.modelId).first<ExistingFaceRow>();
        if (existing && existing.generation !== input.generation) throw new Error('FACE_GENERATION_CONFLICT');
        if (existing && existing.expires_at !== input.expiresAt) throw new Error('FACE_EXPIRY_IMMUTABLE');
        const faceId = existing?.id
          ?? await deterministicId(`face:${photoId}:${face.faceNumber}:${input.modelId}:${input.expiresAt}`);
        const vectorId = existing?.vector_id ?? `${photo.event_id}:${input.generation}:${faceId}`;
        const reservation = existing ? null : await this.reservePartition(photo.event_id, input.generation, now);
        const partitionId = existing?.partition_id ?? reservation?.id;
        if (!partitionId) throw new Error('FACE_PARTITION_UNAVAILABLE');
        if (!existing) {
          try {
            const inserted = await this.database.prepare(
              `INSERT INTO faces (id, event_id, photo_id, face_number, partition_id, vector_id, model_id, expires_at, created_at)
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
                WHERE EXISTS (
                  SELECT 1 FROM photos
                   WHERE id = ?3
                     AND state NOT IN ('deleting', 'deleted')
                     AND face_state = 'indexing'
                     AND updated_at = ?10
                )`,
            ).bind(
              faceId,
              photo.event_id,
              photoId,
              face.faceNumber,
              partitionId,
              vectorId,
              input.modelId,
              input.expiresAt,
              now,
              now,
            ).run();
            if ((inserted.meta.changes ?? 0) !== 1) throw new Error('PHOTO_FACE_INDEX_UNAVAILABLE');
          } catch (error) {
            if (reservation) await this.releasePartition(reservation.id);
            throw error;
          }
        } else {
          if (!(await this.ownsPhotoLease(photoId, now))) throw new Error('PHOTO_FACE_INDEX_UNAVAILABLE');
        }
        // D1 records intent before the provider mutation. If Vectorize fails, a
        // later idempotent retry sees the same row/vector id instead of leaving
        // an untracked biometric vector behind.
        await vectors.upsert(vectorId, face.embedding, {
          eventId: photo.event_id,
          faceId,
          generation: input.generation,
          partitionId,
          photoId,
        });
        if (!(await this.ownsPhotoLease(photoId, now))) {
          try {
            await vectors.delete(vectorId);
          } catch {
            await this.enqueueVectorCleanup(vectorId, now);
          }
          throw new Error('PHOTO_FACE_INDEX_UNAVAILABLE');
        }
        indexed += 1;
      }
      const completed = await this.database.prepare(
        `UPDATE photos
            SET face_state = 'ready', updated_at = ?2
          WHERE id = ?1
            AND state NOT IN ('deleting', 'deleted')
            AND face_state = 'indexing'
            AND updated_at = ?2`,
      ).bind(photoId, now).run();
      if ((completed.meta.changes ?? 0) !== 1) throw new Error('PHOTO_FACE_INDEX_UNAVAILABLE');
      return indexed;
    } catch (error) {
      await this.database.prepare(
        `UPDATE photos
            SET face_state = 'failed', updated_at = ?2
          WHERE id = ?1
            AND state NOT IN ('deleting', 'deleted')
            AND face_state = 'indexing'
            AND updated_at = ?2`,
      ).bind(photoId, now).run();
      throw error;
    }
  }

  async resultsForMatches(eventId: string, matches: FaceVectorMatch[], now: string): Promise<FaceSearchMatch[]> {
    const bestByVector = new Map<string, number>();
    for (const match of matches) {
      const current = bestByVector.get(match.vectorId);
      if (current === undefined || match.score > current) bestByVector.set(match.vectorId, match.score);
    }
    const ids = [...bestByVector.keys()];
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await this.database.prepare(
      `SELECT p.id AS photo_id, p.revision, p.captured_at, p.moment_id, f.vector_id
       FROM photos p JOIN faces f ON f.photo_id = p.id
       WHERE p.event_id = ?1 AND p.state = 'published' AND f.vector_id IN (${placeholders})
         AND (f.expires_at IS NULL OR f.expires_at > ?2)`,
    ).bind(eventId, now, ...ids).all<SearchPhotoRow>();
    const bestByPhoto = new Map<string, { row: SearchPhotoRow; score: number }>();
    for (const row of rows.results as Array<SearchPhotoRow & { vector_id: string }>) {
      const score = bestByVector.get(row.vector_id) ?? 0;
      const current = bestByPhoto.get(row.photo_id);
      if (!current || score > current.score) bestByPhoto.set(row.photo_id, { row, score });
    }
    return [...bestByPhoto.values()].map(({ row, score }) => ({
      photoId: row.photo_id,
      score: Math.max(0, Math.min(1, score)),
      revision: row.revision,
      thumbnailUrl: `/media/${encodeURIComponent(eventId)}/${encodeURIComponent(row.photo_id)}/${row.revision}/thumb`,
      capturedAt: row.captured_at,
      momentId: row.moment_id,
    })).sort((left, right) => right.score - left.score);
  }

  async related(eventId: string, photoId: string): Promise<RelatedPhoto[] | null> {
    const source = await this.database.prepare(
      "SELECT captured_at, moment_id FROM photos WHERE id = ?1 AND event_id = ?2 AND state = 'published'",
    ).bind(photoId, eventId).first<{ captured_at: string | null; moment_id: string | null }>();
    if (!source) return null;
    const result = source.moment_id
      ? await this.database.prepare(
          `SELECT id AS photo_id, revision, captured_at, moment_id FROM photos
           WHERE event_id = ?1 AND state = 'published' AND moment_id = ?2 AND id <> ?3
           ORDER BY sort_key LIMIT 24`,
        ).bind(eventId, source.moment_id, photoId).all<SearchPhotoRow>()
      : source.captured_at
        ? await this.database.prepare(
            `SELECT id AS photo_id, revision, captured_at, moment_id FROM photos
             WHERE event_id = ?1 AND state = 'published' AND id <> ?2 AND captured_at IS NOT NULL
               AND ABS((julianday(captured_at) - julianday(?3)) * 1440) <= 30
             ORDER BY ABS(julianday(captured_at) - julianday(?3)), sort_key LIMIT 24`,
          ).bind(eventId, photoId, source.captured_at).all<SearchPhotoRow>()
        : { results: [] as SearchPhotoRow[] };
    return result.results.map((row) => ({
      photoId: row.photo_id,
      revision: row.revision,
      capturedAt: row.captured_at,
      momentId: row.moment_id,
      thumbnailUrl: `/media/${encodeURIComponent(eventId)}/${encodeURIComponent(row.photo_id)}/${row.revision}/thumb`,
    }));
  }

  async enqueuePurge(eventId: string, now: string): Promise<boolean> {
    const generation = await this.database.prepare(
      'SELECT COALESCE(MAX(generation), 0) AS generation FROM face_partitions WHERE event_id = ?1',
    ).bind(eventId).first<{ generation: number }>();
    const event = await this.database.prepare('SELECT id FROM events WHERE id = ?1').bind(eventId).first();
    if (!event) return false;
    const idempotencyKey = `purge_event_faces:${eventId}:${generation?.generation ?? 0}`;
    const existing = await this.database.prepare(
      'SELECT id FROM maintenance_jobs WHERE idempotency_key = ?1',
    ).bind(idempotencyKey).first();
    if (existing) return true;
    const jobId = crypto.randomUUID();
    await this.database.batch([
      this.database.prepare('UPDATE events SET face_search_enabled = 0, revision = revision + 1, updated_at = ?2 WHERE id = ?1').bind(eventId, now),
      this.database.prepare("UPDATE photos SET face_state = 'deleting', updated_at = ?2 WHERE event_id = ?1 AND face_state <> 'disabled'").bind(eventId, now),
      this.database.prepare(
        `INSERT OR IGNORE INTO maintenance_jobs
         (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
         VALUES (?1, 'purge_event_faces', 'pending', ?2, ?3, 0, ?4, ?4, ?4)`,
      ).bind(jobId, JSON.stringify({ eventId }), idempotencyKey, now),
    ]);
    return true;
  }

  async recordVectorQuery(now: string): Promise<void> {
    await this.database.prepare(
      `INSERT INTO usage_counters (key, value, updated_at) VALUES ('vector_dimensions_queried', 128, ?1)
       ON CONFLICT(key) DO UPDATE SET value = value + 128, updated_at = excluded.updated_at`,
    ).bind(now).run();
  }

  private async reservePartition(eventId: string, generation: number, now: string): Promise<{ id: string }> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await this.database.prepare(
      `SELECT id FROM face_partitions
       WHERE event_id = ?1 AND generation = ?2 AND face_count < 100
       ORDER BY partition_number ASC LIMIT 1`,
      ).bind(eventId, generation).first<PartitionRow>();
      if (existing) {
        const reserved = await this.database.prepare(
          'UPDATE face_partitions SET face_count = face_count + 1 WHERE id = ?1 AND face_count < 100',
        ).bind(existing.id).run();
        if ((reserved.meta.changes ?? 0) === 1) return { id: existing.id };
        continue;
      }
      const number = await this.database.prepare(
      'SELECT COALESCE(MAX(partition_number), -1) + 1 AS next FROM face_partitions WHERE event_id = ?1 AND generation = ?2',
      ).bind(eventId, generation).first<{ next: number }>();
      const id = await deterministicId(`partition:${eventId}:${generation}:${number?.next ?? 0}`);
      try {
        await this.database.prepare(
          'INSERT INTO face_partitions (id, event_id, generation, partition_number, face_count, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)',
        ).bind(id, eventId, generation, number?.next ?? 0, now).run();
        return { id };
      } catch {
        // Another writer may have created this partition number. Retry the
        // conditional reservation against current D1 state.
      }
    }
    throw new Error('FACE_PARTITION_UNAVAILABLE');
  }

  private async releasePartition(partitionId: string): Promise<void> {
    await this.database.prepare(
      'UPDATE face_partitions SET face_count = MAX(0, face_count - 1) WHERE id = ?1',
    ).bind(partitionId).run();
  }

  private async ownsPhotoLease(photoId: string, leaseTimestamp: string): Promise<boolean> {
    const lease = await this.database.prepare(
      `SELECT 1 AS owned FROM photos
        WHERE id = ?1
          AND state NOT IN ('deleting', 'deleted')
          AND face_state = 'indexing'
          AND updated_at = ?2`,
    ).bind(photoId, leaseTimestamp).first<{ owned: number }>();
    return Boolean(lease);
  }

  private async enqueueVectorCleanup(vectorId: string, now: string): Promise<void> {
    await this.database.prepare(
      `INSERT INTO maintenance_jobs
        (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'delete_face_vector', 'pending', ?2, ?3, 0, ?4, ?4, ?4)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    ).bind(
      crypto.randomUUID(),
      JSON.stringify({ vectorId }),
      `delete-face-vector:${vectorId}`,
      now,
    ).run();
  }
}

async function deterministicId(seed: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  return [...digest.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
