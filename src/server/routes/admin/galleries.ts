import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { EventSchema } from '../../../shared/schemas/event';
import {
  AdminCoverPhotoQuerySchema,
  AdminCoverPhotosSchema,
  AdminOriginalsStatusSchema,
  AdminEventListSchema,
  CreateEventRequestSchema,
  DeleteGalleryRequestSchema,
  DeleteGalleryResponseSchema,
  UpdateEventRequestSchema,
} from '../../../shared/schemas/gallery';
import { IdSchema } from '../../../shared/schemas';
import type { AppEnv } from '../../types';
import { isAuthPepper } from '../../auth';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { effectiveQuotaLimits } from '../../services/quotas';
import { hashEventPassword } from '../public/credentials';
import { eventFromRow, findEvent } from '../public/data';
import type { EventRow } from '../public/data';

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

function requiredAuthPepper(value: string | undefined): string {
  if (!isAuthPepper(value)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, {
      cause: new Error('AUTH_PEPPER is missing or too short'),
    });
  }
  return value;
}

function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 90)
    .replace(/-+$/gu, '');
  return slug || 'event';
}

async function availableSlug(database: D1Database, requested: string): Promise<string> {
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = suffix === 1 ? requested : `${requested.slice(0, 94)}-${suffix}`;
    const exists = await database.prepare('SELECT 1 AS found FROM events WHERE slug = ?1').bind(candidate).first();
    if (!exists) return candidate;
  }
  throw new ApiException('SLUG_UNAVAILABLE', 'errors.slugUnavailable', 409);
}

interface OriginalStatusRow { count: number; bytes: number }
interface OriginalJobRow { id: string; state: 'failed' | 'pending' | 'running' }

async function originalStatus(database: D1Database, eventId: string) {
  const [files, imports, job] = await Promise.all([
    database.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(v.byte_size), 0) AS bytes FROM photo_variants v
       JOIN photos p ON p.id = v.photo_id WHERE p.event_id = ?1 AND v.variant = 'original'`,
    ).bind(eventId).first<OriginalStatusRow>(),
    database.prepare(
      `SELECT COUNT(*) AS count FROM imports WHERE event_id = ?1 AND keep_originals = 1
       AND state NOT IN ('completed', 'cancelled')`,
    ).bind(eventId).first<{ count: number }>(),
    database.prepare(
      `SELECT id, state FROM maintenance_jobs WHERE kind = 'delete_gallery_originals'
       AND json_extract(payload_json, '$.eventId') = ?1 AND state IN ('pending', 'running', 'failed')
       ORDER BY CASE state WHEN 'running' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC LIMIT 1`,
    ).bind(eventId).first<OriginalJobRow>(),
  ]);
  return { count: files?.count ?? 0, bytes: files?.bytes ?? 0, activeImports: imports?.count ?? 0,
    cleanupState: job?.state ?? 'idle', jobId: job?.id };
}

export function createAdminEventRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/galleries', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const result = await context.env.DB.prepare('SELECT * FROM events ORDER BY starts_at DESC, id ASC').all<EventRow>();
    const output = AdminEventListSchema.safeParse({ events: result.results.map(eventFromRow) });
    if (!output.success) throw new ApiException('INVALID_RESPONSE', 'errors.internal', 500);
    return context.json(output.data);
  });

  routes.get('/galleries/:eventId/originals', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventId.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, eventId.data);
    if (!event || event.deletingAt) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    return context.json(AdminOriginalsStatusSchema.parse(await originalStatus(context.env.DB, event.id)));
  });

  routes.post('/galleries/:eventId/originals/cleanup', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventId.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, eventId.data);
    if (!event || event.deletingAt) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (event.allowDownloads && event.keepOriginals) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 409);
    const status = await originalStatus(context.env.DB, event.id);
    if (status.activeImports > 0) throw new ApiException('IMPORT_IN_PROGRESS', 'errors.invalidRequest', 409);
    if (status.count === 0 || status.cleanupState === 'pending' || status.cleanupState === 'running') {
      return context.json(AdminOriginalsStatusSchema.parse(status));
    }
    const now = new Date().toISOString();
    // Let already-streaming uploads settle before the first D1-derived R2 sweep.
    const availableAt = new Date(Date.parse(now) + 5 * 60_000).toISOString();
    if (status.cleanupState === 'failed' && status.jobId) {
      await context.env.DB.prepare(
        `UPDATE maintenance_jobs SET state = 'pending', attempts = 0, last_error = NULL,
         available_at = ?2, updated_at = ?2 WHERE id = ?1 AND state = 'failed'`,
      ).bind(status.jobId, now).run();
    } else {
      await context.env.DB.prepare(
        `INSERT OR IGNORE INTO maintenance_jobs
         (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
         VALUES (?1, 'delete_gallery_originals', 'pending', ?2, ?3, 0, ?4, ?5, ?5)`,
      ).bind(crypto.randomUUID(), JSON.stringify({ eventId: event.id }),
        `delete-gallery-originals:${event.id}:${crypto.randomUUID()}`, availableAt, now).run();
    }
    return context.json(AdminOriginalsStatusSchema.parse(await originalStatus(context.env.DB, event.id)), 202);
  });

  routes.post('/galleries/:eventId/originals/abandon-imports', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventId.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, eventId.data);
    if (!event || event.deletingAt) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (event.allowDownloads && event.keepOriginals) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 409);
    await context.env.DB.prepare(
      `UPDATE imports SET state = 'cancelled', updated_at = ?2
       WHERE event_id = ?1 AND keep_originals = 1 AND state NOT IN ('completed', 'cancelled')`,
    ).bind(event.id, new Date().toISOString()).run();
    return context.json(AdminOriginalsStatusSchema.parse(await originalStatus(context.env.DB, event.id)));
  });

  routes.get('/galleries/:eventId/cover-photos', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    const query = AdminCoverPhotoQuerySchema.safeParse(context.req.query());
    if (!eventId.success || !query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, eventId.data);
    if (!event || event.deletingAt) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    const rows = await context.env.DB.prepare(
      `SELECT p.id, p.filename FROM photos p
       JOIN photo_variants v ON v.photo_id = p.id AND v.variant = 'thumb'
       WHERE p.event_id = ?1 AND p.state IN ('variants_ready', 'published')
       ORDER BY p.sort_key, p.id LIMIT 49 OFFSET ?2`,
    ).bind(event.id, query.data.offset).all<{ id: string; filename: string }>();
    const photos = rows.results.slice(0, 48).map((photo) => ({
      id: photo.id,
      filename: photo.filename,
      thumbnailUrl: `/api/v1/admin/galleries/${encodeURIComponent(event.id)}/cover-photos/${encodeURIComponent(photo.id)}`,
    }));
    return context.json(AdminCoverPhotosSchema.parse({
      photos,
      nextOffset: rows.results.length > 48 ? query.data.offset + 48 : null,
    }));
  });

  routes.get('/galleries/:eventId/cover-photos/:photoId', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    const photoId = IdSchema.safeParse(context.req.param('photoId'));
    if (!eventId.success || !photoId.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const variant = await context.env.DB.prepare(
      `SELECT v.storage_key, v.content_type FROM photos p
       JOIN events e ON e.id = p.event_id
       JOIN photo_variants v ON v.photo_id = p.id AND v.variant = 'thumb'
       WHERE e.id = ?1 AND p.id = ?2 AND e.deleting_at IS NULL
         AND p.state IN ('variants_ready', 'published')`,
    ).bind(eventId.data, photoId.data).first<{ storage_key: string; content_type: string }>();
    if (!variant) throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
    const object = await context.env.MEDIA_BUCKET.get(variant.storage_key);
    if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    return new Response(object.body, { headers: {
      'Cache-Control': 'no-store',
      'Content-Type': variant.content_type,
      'X-Content-Type-Options': 'nosniff',
    } });
  });

  routes.post('/galleries', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = CreateEventRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const maximumEvents = (await effectiveQuotaLimits(context.env)).galleryLimit;
    const eventCount = await context.env.DB.prepare('SELECT COUNT(*) AS total FROM events').first<{ total: number }>();
    if ((eventCount?.total ?? 0) >= maximumEvents) {
      throw new ApiException('EVENT_QUOTA_EXCEEDED', 'errors.eventQuotaExceeded', 413);
    }
    const id = crypto.randomUUID();
    const slug = await availableSlug(context.env.DB, input.data.slug ?? slugify(input.data.title));
    const now = new Date().toISOString();
    const eventStatement = context.env.DB.prepare(
      `INSERT INTO events (
        id, slug, title, description, starts_at, timezone, cover_photo_id,
        visibility, access, allow_downloads, face_search_enabled, nearby_search_enabled,
        show_photo_metadata, keep_originals, retention_days, revision, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 0, ?15, ?15)`,
    ).bind(
      id, slug, input.data.title, input.data.description ?? null, input.data.startsAt,
      input.data.timezone, input.data.visibility, input.data.access,
      Number(input.data.allowDownloads), Number(input.data.faceSearchEnabled),
      Number(input.data.nearbySearchEnabled), Number(input.data.showPhotoMetadata), Number(input.data.keepOriginals),
      input.data.retentionDays, now,
    );
    const statements: D1PreparedStatement[] = [eventStatement];
    if (input.data.access === 'protected' && input.data.password) {
      statements.push(context.env.DB.prepare(
        'INSERT INTO event_credentials (event_id, password_hash, access_version, updated_at) VALUES (?1, ?2, 1, ?3)',
      ).bind(id, await hashEventPassword(input.data.password, requiredAuthPepper(context.env.AUTH_PEPPER)), now));
    }
    await context.env.DB.batch(statements);
    const created = await findEvent(context.env.DB, id);
    if (!created) throw new ApiException('EVENT_CREATE_FAILED', 'errors.internal', 500);
    return context.json(EventSchema.parse(created), 201);
  });

  routes.patch('/galleries/:eventId', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = UpdateEventRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (event.deletingAt) throw new ApiException('EVENT_DELETION_PENDING', 'errors.eventNotFound', 409);
    const nextFaceSearchEnabled = input.data.faceSearchEnabled ?? event.faceSearchEnabled;
    const nextNearbySearchEnabled = input.data.nearbySearchEnabled ?? event.nearbySearchEnabled;
    if (nextNearbySearchEnabled && !nextFaceSearchEnabled) {
      throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    }
    const nextAllowDownloads = input.data.allowDownloads ?? event.allowDownloads;
    const nextKeepOriginals = nextAllowDownloads && (input.data.keepOriginals ?? event.keepOriginals);
    if (input.data.keepOriginals === true && !nextAllowDownloads) {
      throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    }
    if (nextKeepOriginals && (!event.keepOriginals || !event.allowDownloads)) {
      const status = await originalStatus(context.env.DB, event.id);
      if (status.cleanupState === 'pending' || status.cleanupState === 'running') {
        throw new ApiException('ORIGINAL_CLEANUP_PENDING', 'errors.invalidRequest', 409);
      }
    }
    const nextAccess = input.data.access ?? event.access;
    const existingVersion = await context.env.DB.prepare(
      'SELECT access_version FROM event_credentials WHERE event_id = ?1',
    ).bind(event.id).first<{ access_version: number }>();
    if (nextAccess === 'protected' && !existingVersion && !input.data.password) {
      throw new ApiException('EVENT_PASSWORD_REQUIRED', 'errors.eventPasswordRequired', 400);
    }
    const columns: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      columns.push(`${column} = ?${values.length + 1}`);
      values.push(value);
    };
    if (input.data.title !== undefined) add('title', input.data.title);
    if (input.data.description !== undefined) add('description', input.data.description);
    if (input.data.startsAt !== undefined) add('starts_at', input.data.startsAt);
    if (input.data.timezone !== undefined) add('timezone', input.data.timezone);
    if (input.data.access !== undefined) add('access', input.data.access);
    if (input.data.allowDownloads !== undefined) add('allow_downloads', Number(input.data.allowDownloads));
    if (input.data.faceSearchEnabled !== undefined) add('face_search_enabled', Number(input.data.faceSearchEnabled));
    if (input.data.nearbySearchEnabled !== undefined) add('nearby_search_enabled', Number(input.data.nearbySearchEnabled));
    else if (input.data.faceSearchEnabled === false) add('nearby_search_enabled', 0);
    if (input.data.showPhotoMetadata !== undefined) add('show_photo_metadata', Number(input.data.showPhotoMetadata));
    if (input.data.keepOriginals !== undefined || !nextAllowDownloads) add('keep_originals', Number(nextKeepOriginals));
    if (input.data.retentionDays !== undefined) add('retention_days', input.data.retentionDays);
    const now = new Date().toISOString();
    if (input.data.coverPhotoId !== undefined && input.data.coverPhotoId !== null) {
      const cover = await context.env.DB.prepare(
        `SELECT p.id FROM photos p JOIN photo_variants v ON v.photo_id = p.id AND v.variant = 'thumb'
         WHERE p.id = ?1 AND p.event_id = ?2 AND p.state IN ('variants_ready', 'published')`,
      ).bind(input.data.coverPhotoId, event.id).first();
      if (!cover) throw new ApiException('INVALID_COVER_PHOTO', 'errors.invalidCoverPhoto', 400);
    }
    if (input.data.coverPhotoId !== undefined) add('cover_photo_id', input.data.coverPhotoId);
    columns.push('revision = revision + 1', `updated_at = ?${values.length + 1}`);
    values.push(now);
    values.push(event.id);
    const statements: D1PreparedStatement[] = [context.env.DB.prepare(
      `UPDATE events SET ${columns.join(', ')} WHERE id = ?${values.length}`,
    ).bind(...values)];
    if (nextAccess === 'public') {
      statements.push(context.env.DB.prepare('DELETE FROM event_credentials WHERE event_id = ?1').bind(event.id));
    } else if (input.data.password) {
      const hash = await hashEventPassword(input.data.password, requiredAuthPepper(context.env.AUTH_PEPPER));
      statements.push(existingVersion
        ? context.env.DB.prepare(
            'UPDATE event_credentials SET password_hash = ?1, access_version = access_version + 1, updated_at = ?2 WHERE event_id = ?3',
          ).bind(hash, now, event.id)
        : context.env.DB.prepare(
            'INSERT INTO event_credentials (event_id, password_hash, access_version, updated_at) VALUES (?1, ?2, 1, ?3)',
          ).bind(event.id, hash, now));
    }
    await context.env.DB.batch(statements);
    const updated = await findEvent(context.env.DB, event.id);
    if (!updated) throw new ApiException('EVENT_UPDATE_FAILED', 'errors.internal', 500);
    return context.json(EventSchema.parse(updated));
  });

  routes.delete('/galleries/:eventId', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    const input = DeleteGalleryRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success || input.data.confirmation !== event.title) {
      throw new ApiException('DELETE_CONFIRMATION_INVALID', 'errors.invalidRequest', 400);
    }
    const now = new Date().toISOString();
    const cleanupAfter = new Date(Date.parse(now) + 5 * 60_000).toISOString();
    const jobId = crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE events
            SET offline_at = COALESCE(offline_at, ?2), deleting_at = COALESCE(deleting_at, ?2),
                revision = revision + 1, updated_at = ?2
          WHERE id = ?1`,
      ).bind(event.id, now),
      context.env.DB.prepare(
        'UPDATE event_credentials SET access_version = access_version + 1, updated_at = ?2 WHERE event_id = ?1',
      ).bind(event.id, now),
      context.env.DB.prepare(
        "UPDATE imports SET state = 'cancelled', updated_at = ?2 WHERE event_id = ?1 AND state NOT IN ('completed', 'cancelled')",
      ).bind(event.id, now),
      context.env.DB.prepare(
        "UPDATE photos SET state = 'deleting', face_state = 'deleting', updated_at = ?2 WHERE event_id = ?1 AND state != 'deleted'",
      ).bind(event.id, now),
      context.env.DB.prepare(
        `INSERT OR IGNORE INTO maintenance_jobs
          (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
         VALUES (?1, 'delete_gallery', 'pending', ?2, ?3, 0, ?4, ?5, ?5)`,
      ).bind(jobId, JSON.stringify({ eventId: event.id }), `delete-gallery:${event.id}`, cleanupAfter, now),
    ]);
    return context.json(DeleteGalleryResponseSchema.parse({ deletionQueued: true }), 202);
  });

  return routes;
}

export function registerAdminEventRoutes(app: Hono<AppEnv>): void {
  app.route('/api/v1/admin', createAdminEventRoutes());
}
