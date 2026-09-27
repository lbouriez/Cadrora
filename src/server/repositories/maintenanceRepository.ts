import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema } from '../../shared/schemas';

const DeletePhotoPayloadSchema = z.object({ eventId: IdSchema, photoId: IdSchema });
const PurgeFacesPayloadSchema = z.object({ eventId: IdSchema });
const PurgeGalleryCachePayloadSchema = z.object({ eventId: IdSchema });
const PurgeExpiredFacesPayloadSchema = z.object({
  eventId: IdSchema,
  expiresBefore: IsoDateTimeSchema,
});
const DeleteFaceVectorPayloadSchema = z.object({ vectorId: z.string().min(1).max(512) });
const DeleteGalleryPayloadSchema = z.object({ eventId: IdSchema });
const DeleteGalleryOriginalsPayloadSchema = z.object({ eventId: IdSchema });
const DeleteReplacedMediaPayloadSchema = z.object({
  eventId: IdSchema,
  photoId: IdSchema,
  revision: z.number().int().nonnegative(),
  storageKeys: z.array(z.string().min(1).max(1_024)).min(1).max(6),
}).refine((value) => value.storageKeys.every((key) => key.startsWith(`events/${value.eventId}/photos/`) &&
  /^events\/[^/]+\/photos\/[^/]+\/\d+\/(thumb|small|medium|large|download|original)\.(jpg|webp|png)$/u.test(key)), {
  message: 'Replacement cleanup keys must belong to this gallery.',
});
const DeleteServiceMediaPayloadSchema = z.object({
  serviceId: z.string().min(1).max(64),
  revision: z.number().int().positive(),
  storageKeys: z.array(z.string().min(1).max(1_024)).min(1).max(4),
}).refine((value) => value.storageKeys.every((key) => key.startsWith(`site/services/${value.serviceId}/${value.revision}/`) &&
  /^site\/services\/[^/]+\/\d+\/(preview|small|medium|large)\.(jpg|webp)$/u.test(key)));
const DeletePortfolioMediaPayloadSchema = z.object({
  photoId: IdSchema,
  storageKeys: z.array(z.string().min(1).max(1_024)).min(1).max(4),
}).refine((value) => value.storageKeys.every((key) => key.startsWith(`site/portfolio/${value.photoId}/`) &&
  /^site\/portfolio\/[^/]+\/(preview|small|medium|large)\.(jpg|webp)$/u.test(key)));

export type MaintenanceKind = 'delete_face_vector' | 'delete_photo_media' | 'delete_gallery' | 'delete_gallery_originals' | 'delete_replaced_media' | 'delete_service_media' | 'delete_portfolio_media' | 'purge_event_faces' | 'purge_expired_faces' | 'reconcile_usage' | 'purge_gallery_cache';

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

export const GALLERY_CLEANUP_BATCH_SIZE = 100;
export type GalleryCleanupBatch =
  | { kind: 'media'; rows: { photoId: string; variant: string; storageKey: string }[] }
  | { kind: 'faces'; rows: { id: string; vectorId: string }[] }
  | { kind: 'chunks'; rows: { importId: string; chunkNumber: number }[] }
  | { kind: 'photos' | 'partitions' | 'imports'; ids: string[] }
  | { kind: 'complete' };
export interface OriginalCleanupRow { photoId: string; storageKey: string }

export interface MaintenanceRepository {
  claimNext(now: string): Promise<MaintenanceJobRecord | null>;
  completeEventFacePurge(jobId: string, eventId: string, now: string): Promise<void>;
  completeExpiredFacePurge(jobId: string, eventId: string, expiresBefore: string, now: string): Promise<void>;
  completeGalleryDeletion(jobId: string, eventId: string, now: string): Promise<void>;
  completeGalleryCleanupBatch(jobId: string, eventId: string, batch: Exclude<GalleryCleanupBatch, { kind: 'complete' }>, now: string): Promise<void>;
  completeOriginalCleanupBatch(jobId: string, rows: OriginalCleanupRow[], now: string): Promise<void>;
  completeJob(jobId: string, now: string): Promise<void>;
  completePhotoDeletion(jobId: string, photoId: string, now: string): Promise<void>;
  eventFaceVectorIds(eventId: string): Promise<string[]>;
  expiredFaceVectorIds(eventId: string, expiresBefore: string): Promise<string[]>;
  galleryCleanupBatch(eventId: string): Promise<GalleryCleanupBatch>;
  originalCleanupBatch(eventId: string): Promise<{ shouldDelete: boolean; rows: OriginalCleanupRow[] }>;
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

  async galleryCleanupBatch(eventId: string): Promise<GalleryCleanupBatch> {
    const variants = await this.database.prepare(
      `SELECT pv.photo_id, pv.variant, pv.storage_key FROM photo_variants pv
       JOIN photos p ON p.id = pv.photo_id WHERE p.event_id = ?1
       ORDER BY pv.photo_id, pv.variant LIMIT ?2`,
    ).bind(eventId, GALLERY_CLEANUP_BATCH_SIZE).all<{ photo_id: string; variant: string; storage_key: string }>();
    if (variants.results.length > 0) return {
      kind: 'media',
      rows: variants.results.map((row) => ({ photoId: row.photo_id, variant: row.variant, storageKey: row.storage_key })),
    };

    const faces = await this.database.prepare(
      'SELECT id, vector_id FROM faces WHERE event_id = ?1 ORDER BY id LIMIT ?2',
    ).bind(eventId, GALLERY_CLEANUP_BATCH_SIZE).all<{ id: string; vector_id: string }>();
    if (faces.results.length > 0) return {
      kind: 'faces', rows: faces.results.map((row) => ({ id: row.id, vectorId: row.vector_id })),
    };

    for (const [kind, table] of [
      ['photos', 'photos'], ['partitions', 'face_partitions'],
    ] as const) {
      const result = await this.database.prepare(
        `SELECT id FROM ${table} WHERE event_id = ?1 ORDER BY id LIMIT ?2`,
      ).bind(eventId, GALLERY_CLEANUP_BATCH_SIZE).all<{ id: string }>();
      if (result.results.length > 0) return { kind, ids: result.results.map((row) => row.id) };
    }
    const chunks = await this.database.prepare(
      `SELECT ic.import_id, ic.chunk_number FROM import_chunks ic
       JOIN imports i ON i.id = ic.import_id WHERE i.event_id = ?1
       ORDER BY ic.import_id, ic.chunk_number LIMIT ?2`,
    ).bind(eventId, GALLERY_CLEANUP_BATCH_SIZE).all<{ import_id: string; chunk_number: number }>();
    if (chunks.results.length > 0) return {
      kind: 'chunks', rows: chunks.results.map((row) => ({ importId: row.import_id, chunkNumber: row.chunk_number })),
    };
    const imports = await this.database.prepare(
      'SELECT id FROM imports WHERE event_id = ?1 ORDER BY id LIMIT ?2',
    ).bind(eventId, GALLERY_CLEANUP_BATCH_SIZE).all<{ id: string }>();
    if (imports.results.length > 0) return { kind: 'imports', ids: imports.results.map((row) => row.id) };
    return { kind: 'complete' };
  }

  async completeGalleryCleanupBatch(
    jobId: string, eventId: string, batch: Exclude<GalleryCleanupBatch, { kind: 'complete' }>, now: string,
  ): Promise<void> {
    const values = batch.kind === 'media' ? batch.rows.map((row) => row.storageKey)
      : batch.kind === 'faces' ? batch.rows.map((row) => row.vectorId)
        : batch.kind === 'chunks' ? batch.rows.map((row) => row.importId) : batch.ids;
    if (values.length === 0 || values.length > GALLERY_CLEANUP_BATCH_SIZE) {
      throw new Error('Invalid gallery cleanup batch size');
    }
    const placeholders = values.map((_, index) => `?${index + 2}`).join(', ');
    let deletion: D1PreparedStatement;
    if (batch.kind === 'media') {
      deletion = this.database.prepare(
        `DELETE FROM photo_variants WHERE photo_id IN (SELECT id FROM photos WHERE event_id = ?1)
         AND storage_key IN (${placeholders})`,
      ).bind(eventId, ...values);
    } else if (batch.kind === 'faces') {
      deletion = this.database.prepare(
        `DELETE FROM faces WHERE event_id = ?1 AND vector_id IN (${placeholders})`,
      ).bind(eventId, ...values);
    } else if (batch.kind === 'chunks') {
      const pairs = batch.rows.map((_, index) => `(?${index * 2 + 2}, ?${index * 2 + 3})`).join(', ');
      deletion = this.database.prepare(
        `DELETE FROM import_chunks WHERE import_id IN (SELECT id FROM imports WHERE event_id = ?1)
         AND (import_id, chunk_number) IN (${pairs})`,
      ).bind(eventId, ...batch.rows.flatMap((row) => [row.importId, row.chunkNumber]));
    } else {
      const table = batch.kind === 'partitions' ? 'face_partitions' : batch.kind;
      const guard = batch.kind === 'photos'
        ? `AND NOT EXISTS (SELECT 1 FROM photo_variants WHERE photo_id = photos.id)
           AND NOT EXISTS (SELECT 1 FROM faces WHERE photo_id = photos.id)`
        : batch.kind === 'partitions'
          ? 'AND NOT EXISTS (SELECT 1 FROM faces WHERE partition_id = face_partitions.id)'
          : `AND NOT EXISTS (SELECT 1 FROM photos WHERE import_id = imports.id)
             AND NOT EXISTS (SELECT 1 FROM import_chunks WHERE import_id = imports.id)`;
      deletion = this.database.prepare(
        `DELETE FROM ${table} WHERE event_id = ?1 AND id IN (${placeholders}) ${guard}`,
      ).bind(eventId, ...values);
    }
    await this.database.batch([
      deletion,
      this.database.prepare(
        `UPDATE maintenance_jobs SET state = 'pending', attempts = 0, last_error = NULL,
         available_at = ?2, updated_at = ?2 WHERE id = ?1`,
      ).bind(jobId, now),
    ]);
  }

  async originalCleanupBatch(eventId: string): Promise<{ shouldDelete: boolean; rows: OriginalCleanupRow[] }> {
    const event = await this.database.prepare(
      'SELECT allow_downloads, keep_originals, deleting_at FROM events WHERE id = ?1',
    ).bind(eventId).first<{ allow_downloads: number; keep_originals: number; deleting_at: string | null }>();
    if (!event || event.deleting_at || (event.allow_downloads === 1 && event.keep_originals === 1)) {
      return { shouldDelete: false, rows: [] };
    }
    const result = await this.database.prepare(
      `SELECT v.photo_id, v.storage_key FROM photo_variants v
       JOIN photos p ON p.id = v.photo_id
       WHERE p.event_id = ?1 AND v.variant = 'original'
       ORDER BY v.photo_id LIMIT 100`,
    ).bind(eventId).all<{ photo_id: string; storage_key: string }>();
    return { shouldDelete: true, rows: result.results.map((row) => ({ photoId: row.photo_id, storageKey: row.storage_key })) };
  }

  async completeOriginalCleanupBatch(jobId: string, rows: OriginalCleanupRow[], now: string): Promise<void> {
    await this.database.batch([
      ...rows.map((row) => this.database.prepare(
        "DELETE FROM photo_variants WHERE photo_id = ?1 AND variant = 'original' AND storage_key = ?2",
      ).bind(row.photoId, row.storageKey)),
      this.database.prepare(
        `UPDATE maintenance_jobs SET state = ?2, attempts = 0, last_error = NULL,
         available_at = ?3, updated_at = ?3 WHERE id = ?1`,
      ).bind(jobId, rows.length === 0 ? 'completed' : 'pending', now),
    ]);
  }

  async completeGalleryDeletion(jobId: string, eventId: string, now: string): Promise<void> {
    await this.database.batch([
      this.database.prepare('DELETE FROM event_credentials WHERE event_id = ?1').bind(eventId),
      this.database.prepare(
        `DELETE FROM events WHERE id = ?1
         AND NOT EXISTS (SELECT 1 FROM photos WHERE event_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM imports WHERE event_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM faces WHERE event_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM face_partitions WHERE event_id = ?1)`,
      ).bind(eventId),
      this.database
        .prepare(
          `UPDATE maintenance_jobs
           SET state = CASE WHEN EXISTS (SELECT 1 FROM events WHERE id = ?3) THEN 'pending' ELSE 'completed' END,
               attempts = 0, last_error = NULL, available_at = ?2, updated_at = ?2
           WHERE id = ?1`,
        ).bind(jobId, now, eventId),
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
           SELECT 'storage_bytes',
             (SELECT COALESCE(SUM(byte_size), 0) FROM photo_variants) +
             (SELECT COALESCE(SUM(byte_size), 0) FROM site_service_variants), ?1
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
    // Deletion and cache invalidation keep retrying until Cloudflare acknowledges cleanup.
    // Other maintenance jobs retain the bounded retry policy and surface as failed for operator review.
    const state = job.kind === 'delete_gallery' || job.kind === 'purge_gallery_cache' || job.attempts < 5 ? 'pending' : 'failed';
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

export function parseDeleteGalleryOriginalsPayload(payload: unknown) {
  return DeleteGalleryOriginalsPayloadSchema.parse(payload);
}

export function parseDeleteReplacedMediaPayload(payload: unknown) {
  return DeleteReplacedMediaPayloadSchema.parse(payload);
}

export function parseDeleteServiceMediaPayload(payload: unknown) {
  return DeleteServiceMediaPayloadSchema.parse(payload);
}

export function parseDeletePortfolioMediaPayload(payload: unknown) {
  return DeletePortfolioMediaPayloadSchema.parse(payload);
}

export function parsePurgeFacesPayload(payload: unknown) {
  return PurgeFacesPayloadSchema.parse(payload);
}

export function parsePurgeGalleryCachePayload(payload: unknown) {
  return PurgeGalleryCachePayloadSchema.parse(payload);
}

export function parsePurgeExpiredFacesPayload(payload: unknown) {
  return PurgeExpiredFacesPayloadSchema.parse(payload);
}
