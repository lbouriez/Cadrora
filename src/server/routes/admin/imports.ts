import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import {
  FinalizePhotoRequestSchema,
  FinalizePhotoResponseSchema,
  ImportCreateRequestSchema,
  ImportCreateResponseSchema,
  ImportDeclarePhotosRequestSchema,
  ImportDeclarePhotosResponseSchema,
  ImportSchema,
  IdSchema,
  PhotoSchema,
  PhotoDuplicateCheckRequestSchema,
  PhotoDuplicateCheckResponseSchema,
  PhotoVariantNameSchema,
  RequiredPhotoVariantNames,
  VariantUploadHeadersSchema,
  VariantUploadResponseSchema,
  type Import,
  type Photo,
  type PhotoDeclaration,
  type PhotoVariant,
} from '../../../shared/schemas';
import { ApiException } from '../../../shared/errors/ApiError';
import { requireAdmin } from '../../middleware';
import { effectiveQuotaLimits } from '../../services/quotas';
import type { AppEnv } from '../../types';

interface ImportRow {
  completed_photos: number;
  created_at: string;
  event_id: string;
  id: string;
  state: Import['state'];
  total_photos: number;
  updated_at: string;
}

interface PhotoRow {
  captured_at: string | null;
  content_type: Photo['contentType'];
  created_at: string;
  event_id: string;
  face_state: Photo['faceState'];
  filename: string;
  height: number;
  id: string;
  import_id: string;
  moment_id: string | null;
  revision: number;
  sort_key: string;
  state: Photo['state'];
  updated_at: string;
  width: number;
}

interface PhotoVariantRow {
  byte_size: number;
  checksum_sha256: string;
  content_type: PhotoVariant['contentType'];
  created_at: string;
  height: number;
  photo_id: string;
  storage_key: string;
  variant: PhotoVariant['variant'];
  width: number;
}

interface CountRow {
  value: number;
}

interface IdRow {
  id: string;
}

interface ChunkRow {
  photo_ids_json: string;
}

const adminImportRoutes = new Hono<AppEnv>();

// PA owns one fail-closed authorization middleware for every admin feature.
adminImportRoutes.use('*', requireAdmin);

adminImportRoutes.post('/galleries/:eventId/photo-duplicates', async (context) => {
  const eventId = parseInput(IdSchema, context.req.param('eventId'));
  const payload = parseInput(PhotoDuplicateCheckRequestSchema, await readJson(context));
  await assertGalleryWritable(context.env.DB, eventId);
  const placeholders = payload.hashes.map(() => '?').join(', ');
  const rows = await context.env.DB.prepare(
    `SELECT DISTINCT source_sha256 FROM photos
     WHERE event_id = ? AND source_sha256 IN (${placeholders})
       AND state NOT IN ('deleting', 'deleted')`,
  ).bind(eventId, ...payload.hashes).all<{ source_sha256: string }>();
  return context.json(PhotoDuplicateCheckResponseSchema.parse({
    existingHashes: rows.results.map((row) => row.source_sha256),
  }));
});

adminImportRoutes.post('/galleries/:eventId/imports', async (context) => {
  const eventId = parseInput(IdSchema, context.req.param('eventId'));
  const payload = parseInput(ImportCreateRequestSchema, await readJson(context));
  const existing = await getImport(context.env.DB, payload.id);
  if (existing) {
    await assertGalleryWritable(context.env.DB, existing.eventId);
    if (existing.eventId !== eventId || existing.totalPhotos !== payload.totalPhotos ||
      await importKeepsOriginals(context.env.DB, payload.id) !== payload.keepOriginals ||
      await importReplacementPhotoId(context.env.DB, payload.id) !== (payload.replacementPhotoId ?? null)) {
      throw new ApiException('IMPORT_ID_CONFLICT', 'errors.importIdConflict', 409);
    }
    return context.json(ImportCreateResponseSchema.parse({ import: existing }));
  }

  const event = await context.env.DB.prepare('SELECT id, keep_originals, access FROM events WHERE id = ? AND deleting_at IS NULL').bind(eventId).first<IdRow & { keep_originals: number; access: string }>();
  if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
  if (payload.keepOriginals && event.keep_originals !== 1) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 409);
  if (payload.replacementPhotoId) {
    if (payload.totalPhotos !== 1 || event.access !== 'protected') throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 409);
    const target = await context.env.DB.prepare(
      `SELECT p.id FROM photos p WHERE p.id = ?1 AND p.event_id = ?2 AND p.state = 'published'
       AND p.selected_for_retouch = 1 AND EXISTS (
         SELECT 1 FROM photo_variants v WHERE v.photo_id = p.id
           AND substr(v.storage_key, 1, length('events/' || p.event_id || '/photos/')) = 'events/' || p.event_id || '/photos/'
       )`,
    ).bind(payload.replacementPhotoId, eventId).first<IdRow>();
    if (!target) throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
  }

  const limit = requiredLimit(context.env.MAX_PHOTOS_PER_EVENT, 'MAX_PHOTOS_PER_EVENT');
  const currentCount = await countEventPhotos(context.env.DB, eventId);
  if (currentCount + payload.totalPhotos > limit + (payload.replacementPhotoId ? 1 : 0)) {
    throw new ApiException('PHOTO_QUOTA_EXCEEDED', 'errors.photoQuotaExceeded', 413);
  }

  const now = new Date().toISOString();
  await context.env.DB.prepare(
    'INSERT INTO imports (id, event_id, state, total_photos, completed_photos, keep_originals, replacement_photo_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(payload.id, eventId, 'pending', payload.totalPhotos, 0, Number(payload.keepOriginals), payload.replacementPhotoId ?? null, now, now)
    .run();
  const created = await getImport(context.env.DB, payload.id);
  if (!created) throw new ApiException('IMPORT_CREATE_FAILED', 'errors.importCreateFailed', 500);
  return context.json(ImportCreateResponseSchema.parse({ import: created }));
});

adminImportRoutes.post('/imports/:importId/cancel', async (context) => {
  const importId = parseInput(IdSchema, context.req.param('importId'));
  const imported = await getImport(context.env.DB, importId);
  if (!imported) throw new ApiException('IMPORT_NOT_FOUND', 'errors.importNotFound', 404);
  await assertGalleryWritable(context.env.DB, imported.eventId);
  if (imported.state !== 'completed') {
    const now = new Date().toISOString();
    // Fence the import and its declared photos in one D1 transaction. The
    // existing photo-media maintenance job then removes D1-derived R2/vector
    // objects in retryable steps, without leaving unready photos that block
    // publication or consume the gallery's photo quota.
    await context.env.DB.batch([
      context.env.DB.prepare(
        "UPDATE imports SET state = 'cancelled', updated_at = ?2 WHERE id = ?1 AND state != 'completed'",
      ).bind(importId, now),
      context.env.DB.prepare(
        "UPDATE photos SET state = 'deleting', face_state = 'deleting', updated_at = ?2 WHERE import_id = ?1 AND state IN ('pending', 'variants_ready')",
      ).bind(importId, now),
      context.env.DB.prepare(
        `INSERT OR IGNORE INTO maintenance_jobs
           (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
         SELECT lower(hex(randomblob(16))), 'delete_photo_media', 'pending',
                json_object('eventId', event_id, 'photoId', id), 'delete-photo:' || id,
                0, ?2, ?2, ?2
           FROM photos WHERE import_id = ?1 AND state = 'deleting'`,
      ).bind(importId, now),
    ]);
  }
  const updated = await getImport(context.env.DB, importId);
  return context.json(ImportCreateResponseSchema.parse({ import: updated }));
});

adminImportRoutes.post('/imports/:importId/photos', async (context) => {
  const importId = parseInput(IdSchema, context.req.param('importId'));
  const payload = parseInput(ImportDeclarePhotosRequestSchema, await readJson(context));
  const imported = await getImport(context.env.DB, importId);
  if (!imported) throw new ApiException('IMPORT_NOT_FOUND', 'errors.importNotFound', 404);
  await assertGalleryWritable(context.env.DB, imported.eventId);
  if (imported.state === 'cancelled' || imported.state === 'completed') {
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }

  const existingChunk = await context.env.DB
    .prepare('SELECT photo_ids_json FROM import_chunks WHERE import_id = ? AND chunk_number = ?')
    .bind(importId, payload.chunkNumber)
    .first<ChunkRow>();
  if (existingChunk && !samePhotoIds(existingChunk.photo_ids_json, payload.photos.map((photo) => photo.id))) {
    throw new ApiException('IMPORT_CHUNK_CONFLICT', 'errors.importChunkConflict', 409);
  }

  const existingPhotos = await getPhotosByIds(context.env.DB, payload.photos.map((photo) => photo.id));
  const existingIds = new Set(existingPhotos.map((photo) => photo.id));
  if (existingPhotos.some((photo) => photo.event_id !== imported.eventId || photo.import_id !== importId)) {
    throw new ApiException('PHOTO_ID_CONFLICT', 'errors.photoIdConflict', 409);
  }
  const newPhotos = payload.photos.filter((photo) => !existingIds.has(photo.id));
  if ((await countImportPhotos(context.env.DB, importId)) + newPhotos.length > imported.totalPhotos) {
    throw new ApiException('IMPORT_TOTAL_EXCEEDED', 'errors.importTotalExceeded', 409);
  }
  const limit = requiredLimit(context.env.MAX_PHOTOS_PER_EVENT, 'MAX_PHOTOS_PER_EVENT');
  const replacementPhotoId = await importReplacementPhotoId(context.env.DB, importId);
  if ((await countEventPhotos(context.env.DB, imported.eventId)) + newPhotos.length > limit + (replacementPhotoId ? 1 : 0)) {
    throw new ApiException('PHOTO_QUOTA_EXCEEDED', 'errors.photoQuotaExceeded', 413);
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    context.env.DB
      .prepare(
        `INSERT INTO import_chunks (import_id, chunk_number, state, photo_ids_json, updated_at)
         VALUES (?, ?, 'uploading', ?, ?)
         ON CONFLICT(import_id, chunk_number) DO UPDATE SET
           state = CASE WHEN import_chunks.state = 'finalized' THEN 'finalized' ELSE 'uploading' END,
           updated_at = excluded.updated_at`,
      )
      .bind(importId, payload.chunkNumber, JSON.stringify(payload.photos.map((photo) => photo.id)), now),
    context.env.DB
      .prepare("UPDATE imports SET state = 'processing', updated_at = ? WHERE id = ? AND state IN ('pending', 'paused', 'processing')")
      .bind(now, importId),
  ];
  for (const photo of newPhotos) statements.push(insertPhoto(context.env.DB, imported.eventId, importId, photo, now, Boolean(replacementPhotoId)));
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    // A concurrent import may reserve the same gallery/hash after preflight.
    // Fail clearly and keep the journal resumable instead of reporting a 500.
    const hashes = newPhotos.flatMap((photo) => photo.sourceSha256 ? [photo.sourceSha256] : []);
    if (hashes.length > 0) {
      const placeholders = hashes.map(() => '?').join(', ');
      const duplicates = await context.env.DB.prepare(
        `SELECT source_sha256 FROM photos WHERE event_id = ? AND source_sha256 IN (${placeholders})
         AND state NOT IN ('deleting', 'deleted')`,
      ).bind(imported.eventId, ...hashes).all<{ source_sha256: string }>();
      if (duplicates.results.length > 0) {
        throw new ApiException('PHOTO_DUPLICATE_CONFLICT', 'errors.photoDuplicateConflict', 409, { cause: error });
      }
    }
    throw error;
  }

  const refreshed = await getImport(context.env.DB, importId);
  if (!refreshed) throw new ApiException('IMPORT_NOT_FOUND', 'errors.importNotFound', 404);
  return context.json(
    ImportDeclarePhotosResponseSchema.parse({ import: refreshed, photoIds: payload.photos.map((photo) => photo.id) }),
  );
});

/** Binary media ingress: only a small magic-byte prefix is inspected before the body streams to private R2. */
adminImportRoutes.put('/photos/:photoId/variants/:variant', async (context) => {
  const photoId = parseInput(IdSchema, context.req.param('photoId'));
  const variant = parseInput(PhotoVariantNameSchema.or(z.literal('original')), context.req.param('variant'));
  const headers = parseInput(VariantUploadHeadersSchema, {
    byteSize: context.req.header('X-Cadrora-Byte-Size'),
    checksumSha256: context.req.header('X-Cadrora-Checksum-Sha256'),
    contentType: contentTypeWithoutParameters(context.req.header('Content-Type')),
    height: context.req.header('X-Cadrora-Height'),
    width: context.req.header('X-Cadrora-Width'),
  });
  const photo = await getPhoto(context.env.DB, photoId);
  if (!photo || photo.state === 'deleted' || photo.state === 'deleting') {
    throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
  }
  await assertGalleryWritable(context.env.DB, photo.eventId);
  const imported = await getImport(context.env.DB, photo.importId);
  if (!imported || imported.state === 'cancelled' || imported.state === 'completed') {
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }
  if (variant === 'original') {
    // EXIF orientations 5-8 swap the source pixel dimensions without changing the displayed photo dimensions.
    const dimensionsMatch = (headers.width === photo.width && headers.height === photo.height) ||
      (headers.width === photo.height && headers.height === photo.width);
    if (!await importKeepsOriginals(context.env.DB, photo.importId) || headers.contentType !== photo.contentType ||
      !dimensionsMatch) {
      throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
    }
  } else if (headers.contentType === 'image/png') {
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }

  const declaredContentLength = parseContentLength(context.req.header('Content-Length'));
  if (declaredContentLength !== undefined && declaredContentLength !== headers.byteSize) {
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }

  const existing = await getVariant(context.env.DB, photoId, variant);
  if (existing) {
    if (existing.byteSize !== headers.byteSize || existing.checksumSha256 !== headers.checksumSha256 ||
      existing.contentType !== headers.contentType || existing.width !== headers.width || existing.height !== headers.height) {
      throw new ApiException('VARIANT_CONFLICT', 'errors.invalidVariantMedia', 409);
    }
  }
  const usedBytes = await totalStoredBytes(context.env.DB);
  const limit = (await effectiveQuotaLimits(context.env)).storageLimitBytes;
  if (usedBytes - (existing?.byteSize ?? 0) + headers.byteSize > limit) {
    throw new ApiException('STORAGE_QUOTA_EXCEEDED', 'errors.storageQuotaExceeded', 413);
  }

  // Fetch request bodies are byte streams; Hono's DOM typing widens their chunk type at this external boundary.
  const requestBody = context.req.raw.body as unknown as ReadableStream<Uint8Array> | null;
  if (!requestBody) throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  const inspected = await inspectStreamPrefix(requestBody, 12);
  if (sniffEncodedMime(inspected.prefix) !== headers.contentType) {
    await inspected.stream.cancel();
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }

  const extension = headers.contentType === 'image/webp' ? 'webp' : headers.contentType === 'image/png' ? 'png' : 'jpg';
  const storageKey = `events/${photo.eventId}/photos/${photo.id}/${photo.revision}/${variant}.${extension}`;
  let stored: R2Object | null;
  try {
    // Prefix inspection creates an ordinary stream and loses the incoming
    // request body's known length. R2 requires a known-length stream for put().
    stored = await context.env.MEDIA_BUCKET.put(storageKey,
      inspected.stream.pipeThrough(new FixedLengthStream(headers.byteSize)), {
      customMetadata: { checksumSha256: headers.checksumSha256 },
      httpMetadata: { contentType: headers.contentType },
      // R2 validates the digest while consuming the stream, avoiding a second full-body buffer in the Worker.
      sha256: headers.checksumSha256,
    });
  } catch (error) {
    if (isR2ChecksumMismatch(error)) {
      throw new ApiException('VARIANT_CHECKSUM_MISMATCH', 'errors.variantChecksumMismatch', 422, { cause: error });
    }
    throw error;
  }
  if (!stored || stored.size !== headers.byteSize || inspected.streamedByteSize() !== headers.byteSize) {
    if (stored) await context.env.MEDIA_BUCKET.delete(storageKey);
    throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
  }

  const currentImport = await getImport(context.env.DB, photo.importId);
  if (!currentImport || currentImport.state === 'cancelled') {
    if (!existing) await context.env.MEDIA_BUCKET.delete(storageKey);
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }

  const now = new Date().toISOString();
  const savedVariant = await context.env.DB
    .prepare(
      `INSERT INTO photo_variants (photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM imports WHERE id = ? AND state NOT IN ('cancelled', 'completed'))
       ON CONFLICT(photo_id, variant) DO UPDATE SET
         storage_key = excluded.storage_key,
         content_type = excluded.content_type,
         byte_size = excluded.byte_size,
         width = excluded.width,
         height = excluded.height,
         checksum_sha256 = excluded.checksum_sha256`,
    )
    .bind(
      photoId,
      variant,
      storageKey,
      headers.contentType,
      headers.byteSize,
      headers.width,
      headers.height,
      headers.checksumSha256,
      now,
      photo.importId,
    )
    .run();
  if ((savedVariant.meta.changes ?? 0) === 0) {
    if (!existing) await context.env.MEDIA_BUCKET.delete(storageKey);
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }
  const saved = await getVariant(context.env.DB, photoId, variant);
  if (!saved) throw new ApiException('VARIANT_SAVE_FAILED', 'errors.variantSaveFailed', 500);
  return context.json(VariantUploadResponseSchema.parse({ variant: saved }));
});

adminImportRoutes.post('/photos/:photoId/finalize', async (context) => {
  parseInput(FinalizePhotoRequestSchema, await readJson(context));
  const photoId = parseInput(IdSchema, context.req.param('photoId'));
  const photo = await getPhoto(context.env.DB, photoId);
  if (!photo || photo.state === 'deleting' || photo.state === 'deleted') {
    throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
  }
  await assertGalleryWritable(context.env.DB, photo.eventId);
  const activeImport = await getImport(context.env.DB, photo.importId);
  if (!activeImport || activeImport.state === 'cancelled') {
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }
  const variants = await context.env.DB
    .prepare('SELECT variant FROM photo_variants WHERE photo_id = ?')
    .bind(photoId)
    .all<{ variant: string }>();
  const names = new Set(variants.results.map((variant) => variant.variant));
  if (!RequiredPhotoVariantNames.every((name) => names.has(name)) ||
    (await importKeepsOriginals(context.env.DB, photo.importId) && !names.has('original'))) {
    throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
  }

  const now = new Date().toISOString();
  await context.env.DB
    .prepare("UPDATE photos SET state = 'variants_ready', updated_at = ? WHERE id = ? AND state IN ('pending', 'variants_ready')")
    .bind(now, photoId)
    .run();
  const completed = await context.env.DB
    .prepare("SELECT COUNT(*) AS value FROM photos WHERE import_id = ? AND state IN ('variants_ready', 'published')")
    .bind(photo.importId)
    .first<CountRow>();
  const imported = await getImport(context.env.DB, photo.importId);
  if (!imported) throw new ApiException('IMPORT_NOT_FOUND', 'errors.importNotFound', 404);
  const completedPhotos = Math.min(completed?.value ?? 0, imported.totalPhotos);
  const state = completedPhotos >= imported.totalPhotos ? 'completed' : 'processing';
  const updatedImport = await context.env.DB
    .prepare("UPDATE imports SET completed_photos = ?, state = ?, updated_at = ? WHERE id = ? AND state != 'cancelled'")
    .bind(completedPhotos, state, now, imported.id)
    .run();
  if ((updatedImport.meta.changes ?? 0) === 0) {
    throw new ApiException('IMPORT_NOT_WRITABLE', 'errors.importNotWritable', 409);
  }
  const finalized = await getPhoto(context.env.DB, photoId);
  const refreshedImport = await getImport(context.env.DB, photo.importId);
  if (!finalized || !refreshedImport) throw new ApiException('FINALIZE_FAILED', 'errors.finalizeFailed', 500);
  return context.json(FinalizePhotoResponseSchema.parse({ import: refreshedImport, photo: finalized }));
});

/** Root integration hook. Register after auth middleware and before cache middleware. */
export function registerAdminImportRoutes(app: Hono<AppEnv>): void {
  app.route('/api/v1/admin', adminImportRoutes);
}

export { adminImportRoutes };

async function readJson(context: Context<AppEnv>): Promise<unknown> {
  try {
    return await context.req.json();
  } catch (error) {
    throw new ApiException('INVALID_JSON', 'errors.invalidJson', 422, { cause: error });
  }
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 422);
  return parsed.data;
}

function requiredLimit(value: string | undefined, binding: string): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, { cause: new Error(`${binding} is invalid`) });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, { cause: new Error(`${binding} is unsafe`) });
  }
  return parsed;
}

async function getImport(database: D1Database, importId: string): Promise<Import | undefined> {
  const row = await database
    .prepare('SELECT id, event_id, state, total_photos, completed_photos, created_at, updated_at FROM imports WHERE id = ?')
    .bind(importId)
    .first<ImportRow>();
  return row ? importFromRow(row) : undefined;
}

async function importKeepsOriginals(database: D1Database, importId: string): Promise<boolean> {
  const row = await database.prepare('SELECT keep_originals FROM imports WHERE id = ?').bind(importId).first<{ keep_originals: number }>();
  return row?.keep_originals === 1;
}

async function importReplacementPhotoId(database: D1Database, importId: string): Promise<string | null> {
  const row = await database.prepare('SELECT replacement_photo_id FROM imports WHERE id = ?').bind(importId).first<{ replacement_photo_id: string | null }>();
  return row?.replacement_photo_id ?? null;
}

async function assertGalleryWritable(database: D1Database, eventId: string): Promise<void> {
  const event = await database
    .prepare('SELECT id FROM events WHERE id = ? AND deleting_at IS NULL')
    .bind(eventId)
    .first<IdRow>();
  if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
}

async function getPhoto(database: D1Database, photoId: string): Promise<Photo | undefined> {
  const row = await database
    .prepare(
      `SELECT id, event_id, import_id, filename, content_type, width, height, captured_at, moment_id, sort_key,
       revision, state, face_state, created_at, updated_at FROM photos WHERE id = ?`,
    )
    .bind(photoId)
    .first<PhotoRow>();
  return row ? photoFromRow(row) : undefined;
}

async function getPhotosByIds(database: D1Database, ids: string[]): Promise<(PhotoRow & { import_id: string })[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const result = await database
    .prepare(`SELECT id, event_id, import_id FROM photos WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<PhotoRow & { import_id: string }>();
  return result.results;
}

function insertPhoto(
  database: D1Database,
  eventId: string,
  importId: string,
  photo: PhotoDeclaration,
  now: string,
  replacementStaging: boolean,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO photos (
        id, event_id, import_id, filename, content_type, width, height, captured_at, moment_id, sort_key,
        revision, state, face_state, source_sha256, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', 'disabled', ?, ?, ?)`,
    )
    .bind(
      photo.id,
      eventId,
      importId,
      photo.filename,
      photo.contentType,
      photo.width,
      photo.height,
      photo.capturedAt ?? null,
      null,
      photo.sortKey,
      replacementStaging ? null : (photo.sourceSha256 ?? null),
      now,
      now,
    );
}

async function countEventPhotos(database: D1Database, eventId: string): Promise<number> {
  return (
    (await database
      .prepare("SELECT COUNT(*) AS value FROM photos WHERE event_id = ? AND state NOT IN ('deleting', 'deleted')")
      .bind(eventId)
      .first<CountRow>())?.value ?? 0
  );
}

async function countImportPhotos(database: D1Database, importId: string): Promise<number> {
  return (
    (await database.prepare('SELECT COUNT(*) AS value FROM photos WHERE import_id = ?').bind(importId).first<CountRow>())
      ?.value ?? 0
  );
}

async function totalStoredBytes(database: D1Database): Promise<number> {
  return (await database.prepare('SELECT COALESCE(SUM(byte_size), 0) AS value FROM photo_variants').first<CountRow>())?.value ?? 0;
}

function importFromRow(row: ImportRow): Import {
  return ImportSchema.parse({
    completedPhotos: row.completed_photos,
    createdAt: row.created_at,
    eventId: row.event_id,
    id: row.id,
    state: row.state,
    totalPhotos: row.total_photos,
    updatedAt: row.updated_at,
  });
}

function photoFromRow(row: PhotoRow): Photo {
  return PhotoSchema.parse({
    capturedAt: row.captured_at,
    contentType: row.content_type,
    createdAt: row.created_at,
    eventId: row.event_id,
    faceState: row.face_state,
    filename: row.filename,
    height: row.height,
    id: row.id,
    importId: row.import_id,
    momentId: row.moment_id,
    revision: row.revision,
    sortKey: row.sort_key,
    state: row.state,
    updatedAt: row.updated_at,
    width: row.width,
  });
}

async function getVariant(
  database: D1Database,
  photoId: string,
  variant: PhotoVariant['variant'],
): Promise<PhotoVariant | undefined> {
  const row = await database
    .prepare(
      `SELECT photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at
       FROM photo_variants WHERE photo_id = ? AND variant = ?`,
    )
    .bind(photoId, variant)
    .first<PhotoVariantRow>();
  if (!row) return undefined;
  return {
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    height: row.height,
    photoId: row.photo_id,
    storageKey: row.storage_key,
    variant: row.variant,
    width: row.width,
  };
}

function samePhotoIds(serialized: string, expected: string[]): boolean {
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.length === expected.length && parsed.every((id, index) => id === expected[index]);
  } catch {
    return false;
  }
}

function contentTypeWithoutParameters(value: string | undefined): string | undefined {
  return value?.split(';', 1)[0]?.trim().toLowerCase();
}

function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

interface InspectedStream {
  prefix: Uint8Array;
  stream: ReadableStream<Uint8Array>;
  streamedByteSize: () => number;
}

async function inspectStreamPrefix(body: ReadableStream<Uint8Array>, prefixLength: number): Promise<InspectedStream> {
  const reader = body.getReader();
  const bufferedChunks: Uint8Array[] = [];
  const prefix = new Uint8Array(prefixLength);
  let prefixBytes = 0;
  let sourceFinished = false;

  while (prefixBytes < prefixLength) {
    const next = await reader.read();
    if (next.done) {
      sourceFinished = true;
      break;
    }
    bufferedChunks.push(next.value);
    const copied = Math.min(next.value.byteLength, prefixLength - prefixBytes);
    prefix.set(next.value.subarray(0, copied), prefixBytes);
    prefixBytes += copied;
  }

  let streamedBytes = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = bufferedChunks.shift();
      if (chunk) {
        streamedBytes += chunk.byteLength;
        controller.enqueue(chunk);
        return;
      }
      if (sourceFinished) {
        controller.close();
        return;
      }
      try {
        const next = await reader.read();
        if (next.done) {
          sourceFinished = true;
          controller.close();
          return;
        }
        streamedBytes += next.value.byteLength;
        controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });

  return {
    prefix: prefix.subarray(0, prefixBytes),
    stream,
    streamedByteSize: () => streamedBytes,
  };
}

function sniffEncodedMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return undefined;
}

function isR2ChecksumMismatch(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 10037;
}
