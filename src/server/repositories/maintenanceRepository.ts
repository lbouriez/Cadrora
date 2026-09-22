import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema } from '../../shared/schemas';

const DeletePhotoPayloadSchema = z.object({ eventId: IdSchema, photoId: IdSchema });
const PurgeFacesPayloadSchema = z.object({ eventId: IdSchema });
const PurgeExpiredFacesPayloadSchema = z.object({
  eventId: IdSchema,
  expiresBefore: IsoDateTimeSchema,
});
const DeleteFaceVectorPayloadSchema = z.object({ vectorId: z.string().min(1).max(512) });
const DeleteGalleryPayloadSchema = z.object({ eventId: IdSchema });

export type MaintenanceKind = 'delete_face_vector' | 'delete_photo_media' | 'delete_gallery' | 'purge_event_faces' | 'purge_expired_faces' | 'reconcile_usage';

export const MAINTENANCE_LEASE_MS = 15 * 60_000;

export interface MaintenanceJobRecord {
  attempts: number;
  id: string;
  kind: MaintenanceKind;
  payload: unknown;
}

interface MaintenanceJobRow {
  attempts: number;
  id: string;
  kind: MaintenanceKind;
  payload_json: string;
}

export interface PhotoCleanupData {
  storageKeys: string[];
  vectorIds: string[];
}

export type GalleryCleanupData = PhotoCleanupData;

export interface MaintenanceRepository {
  claimNext(now: string): Promise<MaintenanceJobRecord | null>;
  completeEventFacePurge(jobId: string, eventId: string, now: string): Promise<void>;
  completeExpiredFacePurge(jobId: string, eventId: string, expiresBefore: string, now: string): Promise<void>;
  completeGalleryDeletion(jobId: string, eventId: string, now: string): Promise<void>;
  completeJob(jobId: string, now: string): Promise<void>;
  completePhotoDeletion(jobId: string, photoId: string, now: string): Promise<void>;
  eventFaceVectorIds(eventId: string): Promise<string[]>;
  expiredFaceVectorIds(eventId: string, expiresBefore: string): Promise<string[]>;
  galleryCleanupData(eventId: string): Promise<GalleryCleanupData>;
  photoCleanupData(photoId: string): Promise<PhotoCleanupData>;
  reconcileUsage(now: string): Promise<void>;
  retryJob(job: MaintenanceJobRecord, error: string, availableAt: string, now: string): Promise<void>;
}

export class D1MaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly database: D1Database) {}

  async claimNext(now: string): Promise<MaintenanceJobRecord | null> {
    const staleBefore = new Date(Date.parse(now) - MAINTENANCE_LEASE_MS).toISOString();
    const row = await this.database
      .prepare(
        `SELECT id, kind, payload_json, attempts
           FROM maintenance_jobs
          WHERE (state = 'pending' AND available_at <= ?1)
             OR (state = 'running' AND updated_at <= ?2)
          ORDER BY available_at, created_at
          LIMIT 1`,
      )
      .bind(now, staleBefore)
      .first<MaintenanceJobRow>();
    if (!row) return null;

    const claimed = await this.database
      .prepare(
        `UPDATE maintenance_jobs
            SET state = 'running', attempts = attempts + 1, updated_at = ?2
          WHERE id = ?1
            AND ((state = 'pending' AND available_at <= ?2)
              OR (state = 'running' AND updated_at <= ?3))`,
      )
      .bind(row.id, now, staleBefore)
      .run();
    if ((claimed.meta.changes ?? 0) !== 1) return null;

    return {
      attempts: row.attempts + 1,
      id: row.id,
      kind: row.kind,
      payload: JSON.parse(row.payload_json) as unknown,
    };
  }

  async photoCleanupData(photoId: string): Promise<PhotoCleanupData> {
    const [variantRows, faceRows] = await Promise.all([
      this.database
        .prepare('SELECT storage_key FROM photo_variants WHERE photo_id = ?1')
        .bind(photoId)
        .all<{ storage_key: string }>(),
      this.database
        .prepare('SELECT vector_id FROM faces WHERE photo_id = ?1')
        .bind(photoId)
        .all<{ vector_id: string }>(),
    ]);

    return {
      storageKeys: variantRows.results.map((row) => row.storage_key),
      vectorIds: faceRows.results.map((row) => row.vector_id),
    };
  }

  async galleryCleanupData(eventId: string): Promise<GalleryCleanupData> {
    const [variantRows, faceRows] = await Promise.all([
      this.database
        .prepare(
          `SELECT pv.storage_key
             FROM photo_variants pv
             JOIN photos p ON p.id = pv.photo_id
            WHERE p.event_id = ?1`,
        )
        .bind(eventId)
        .all<{ storage_key: string }>(),
      this.database
        .prepare('SELECT vector_id FROM faces WHERE event_id = ?1')
        .bind(eventId)
        .all<{ vector_id: string }>(),
    ]);
    return {
      storageKeys: variantRows.results.map((row) => row.storage_key),
      vectorIds: faceRows.results.map((row) => row.vector_id),
    };
  }

  async completeGalleryDeletion(jobId: string, eventId: string, now: string): Promise<void> {
    await this.database.batch([
      this.database.prepare('DELETE FROM faces WHERE event_id = ?1').bind(eventId),
      this.database.prepare('DELETE FROM face_partitions WHERE event_id = ?1').bind(eventId),
      this.database.prepare(
        'DELETE FROM photo_variants WHERE photo_id IN (SELECT id FROM photos WHERE event_id = ?1)',
      ).bind(eventId),
      this.database.prepare('DELETE FROM photos WHERE event_id = ?1').bind(eventId),
      this.database.prepare(
        'DELETE FROM import_chunks WHERE import_id IN (SELECT id FROM imports WHERE event_id = ?1)',
      ).bind(eventId),
      this.database.prepare('DELETE FROM imports WHERE event_id = ?1').bind(eventId),
      this.database.prepare('DELETE FROM event_credentials WHERE event_id = ?1').bind(eventId),
      this.database.prepare('DELETE FROM events WHERE id = ?1').bind(eventId),
      this.database
        .prepare("UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(jobId, now),
    ]);
  }

  async completePhotoDeletion(jobId: string, photoId: string, now: string): Promise<void> {
    await this.database.batch([
      this.database.prepare('DELETE FROM faces WHERE photo_id = ?1').bind(photoId),
      this.database.prepare(
        `UPDATE face_partitions
            SET face_count = (SELECT COUNT(*) FROM faces WHERE partition_id = face_partitions.id)
          WHERE event_id = (SELECT event_id FROM photos WHERE id = ?1)`,
      ).bind(photoId),
      this.database.prepare(
        `DELETE FROM face_partitions
          WHERE event_id = (SELECT event_id FROM photos WHERE id = ?1)
            AND face_count = 0`,
      ).bind(photoId),
      this.database.prepare('DELETE FROM photo_variants WHERE photo_id = ?1').bind(photoId),
      this.database
        .prepare("UPDATE photos SET state = 'deleted', face_state = 'disabled', updated_at = ?2 WHERE id = ?1")
        .bind(photoId, now),
      this.database
        .prepare("UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(jobId, now),
    ]);
  }

  async eventFaceVectorIds(eventId: string): Promise<string[]> {
    const result = await this.database
      .prepare('SELECT vector_id FROM faces WHERE event_id = ?1')
      .bind(eventId)
      .all<{ vector_id: string }>();
    return result.results.map((row) => row.vector_id);
  }

  async expiredFaceVectorIds(eventId: string, expiresBefore: string): Promise<string[]> {
    const result = await this.database
      .prepare(
        'SELECT vector_id FROM faces WHERE event_id = ?1 AND expires_at IS NOT NULL AND expires_at <= ?2',
      )
      .bind(eventId, expiresBefore)
      .all<{ vector_id: string }>();
    return result.results.map((row) => row.vector_id);
  }

  async completeEventFacePurge(jobId: string, eventId: string, now: string): Promise<void> {
    await this.database.batch([
      this.database.prepare('DELETE FROM faces WHERE event_id = ?1').bind(eventId),
      this.database.prepare('DELETE FROM face_partitions WHERE event_id = ?1').bind(eventId),
      this.database
        .prepare("UPDATE photos SET face_state = 'disabled', updated_at = ?2 WHERE event_id = ?1")
        .bind(eventId, now),
      this.database
        .prepare("UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(jobId, now),
    ]);
  }

  async completeExpiredFacePurge(
    jobId: string,
    eventId: string,
    expiresBefore: string,
    now: string,
  ): Promise<void> {
    await this.database.batch([
      this.database
        .prepare('DELETE FROM faces WHERE event_id = ?1 AND expires_at IS NOT NULL AND expires_at <= ?2')
        .bind(eventId, expiresBefore),
      this.database.prepare(
        `UPDATE face_partitions
            SET face_count = (SELECT COUNT(*) FROM faces WHERE partition_id = face_partitions.id)
          WHERE event_id = ?1`,
      ).bind(eventId),
      this.database.prepare('DELETE FROM face_partitions WHERE event_id = ?1 AND face_count = 0').bind(eventId),
      this.database.prepare(
        `UPDATE photos
            SET face_state = CASE
              WHEN EXISTS (SELECT 1 FROM faces WHERE faces.photo_id = photos.id) THEN 'ready'
              ELSE 'expired'
            END,
                updated_at = ?2
          WHERE event_id = ?1 AND face_state NOT IN ('disabled', 'deleting')`,
      ).bind(eventId, now),
      this.database
        .prepare("UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(jobId, now),
    ]);
  }

  async reconcileUsage(now: string): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO usage_counters (key, value, updated_at)
           SELECT 'storage_bytes', COALESCE(SUM(byte_size), 0), ?1 FROM photo_variants
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .bind(now),
      this.database
        .prepare(
          `INSERT INTO usage_counters (key, value, updated_at)
           SELECT 'faces', COUNT(*), ?1 FROM faces
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .bind(now),
    ]);
  }

  async completeJob(jobId: string, now: string): Promise<void> {
    await this.database
      .prepare("UPDATE maintenance_jobs SET state = 'completed', last_error = NULL, updated_at = ?2 WHERE id = ?1")
      .bind(jobId, now)
      .run();
  }

  async retryJob(
    job: MaintenanceJobRecord,
    error: string,
    availableAt: string,
    now: string,
  ): Promise<void> {
    // Gallery deletion remains hidden and retryable until every provider confirms cleanup.
    // Other maintenance jobs retain the bounded retry policy and surface as failed for operator review.
    const state = job.kind === 'delete_gallery' || job.attempts < 5 ? 'pending' : 'failed';
    await this.database
      .prepare(
        `UPDATE maintenance_jobs
            SET state = ?2, last_error = ?3, available_at = ?4, updated_at = ?5
          WHERE id = ?1`,
      )
      .bind(job.id, state, error.slice(0, 1_000), availableAt, now)
      .run();
  }
}

export function parseDeletePhotoPayload(payload: unknown) {
  return DeletePhotoPayloadSchema.parse(payload);
}

export function parseDeleteFaceVectorPayload(payload: unknown) {
  return DeleteFaceVectorPayloadSchema.parse(payload);
}

export function parseDeleteGalleryPayload(payload: unknown) {
  return DeleteGalleryPayloadSchema.parse(payload);
}

export function parsePurgeFacesPayload(payload: unknown) {
  return PurgeFacesPayloadSchema.parse(payload);
}

export function parsePurgeExpiredFacesPayload(payload: unknown) {
  return PurgeExpiredFacesPayloadSchema.parse(payload);
}
