import type { Context, Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import {
  AdminFaceInputSchema,
  AdminFaceResultSchema,
  FaceSearchRequestSchema,
  FaceSearchResponseSchema,
  IdSchema,
  PurgeFacesResponseSchema,
  RelatedPhotosResponseSchema,
} from '../../shared/schemas';
import { applyCachePolicy } from '../middleware/cacheHeaders';
import { D1FaceSearchRepository } from '../repositories/faceSearchRepository';
import type { FaceSearchRepository } from '../repositories/faceSearchRepository';
import { CloudflareFaceVectorService } from '../services/faceVectorSearch';
import type { FaceVectorMatch, FaceVectorService } from '../services/faceVectorSearch';
import type { AppEnv } from '../types';
import { hasCurrentEventAccess } from './public/access';
import { findEvent } from './public/data';
import { signFaceSearchCursor, verifyFaceSearchCursor } from './faceSearchCursor';

export interface FaceSearchRouteDependencies {
  now: () => string;
  repository: (context: Context<AppEnv>) => FaceSearchRepository;
  vectors: (context: Context<AppEnv>) => FaceVectorService;
}

const defaultDependencies: FaceSearchRouteDependencies = {
  now: () => new Date().toISOString(),
  repository: (context) => new D1FaceSearchRepository(context.env.DB),
  vectors: (context) => new CloudflareFaceVectorService(context.env.FACE_INDEX),
};

function requireAdmin(context: Context<AppEnv>): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
  applyCachePolicy(context, 'admin');
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function requireSearchableEvent(context: Context<AppEnv>, locator: string) {
  const event = await findEvent(context.env.DB, locator);
  if (!event || event.visibility === 'draft') throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
  applyCachePolicy(context, event.access === 'public' ? 'event-public' : 'event-protected');
  if (!(await hasCurrentEventAccess(context, event))) {
    throw new ApiException('EVENT_ACCESS_REQUIRED', 'errors.eventAccessRequired', 401);
  }
  if (!event.faceSearchEnabled) throw new ApiException('FACE_SEARCH_DISABLED', 'errors.faceSearchDisabled', 409);
  return event;
}

export function registerFaceSearchRoutes(
  app: Hono<AppEnv>,
  dependencies: FaceSearchRouteDependencies = defaultDependencies,
): void {
  app.post('/api/v1/admin/photos/:photoId/faces', async (context) => {
    requireAdmin(context);
    const photoId = IdSchema.safeParse(context.req.param('photoId'));
    const input = AdminFaceInputSchema.safeParse(await context.req.json<unknown>().catch(() => null));
    if (!photoId.success || !input.success) throw new ApiException('INVALID_FACE_INPUT', 'errors.invalidFaceInput', 400);
    if (Date.parse(input.data.expiresAt) <= Date.parse(dependencies.now())) {
      throw new ApiException('FACE_EXPIRY_REQUIRED', 'errors.invalidFaceExpiry', 400);
    }
    const vectors = dependencies.vectors(context);
    if (!vectors.available()) throw new ApiException('FACE_INDEX_UNAVAILABLE', 'errors.faceSearchUnavailable', 503);
    try {
      const indexed = await dependencies.repository(context).upsertPhotoFaces(
        photoId.data,
        input.data,
        vectors,
        dependencies.now(),
        positiveInteger(context.env.MAX_FACES_PER_EVENT, 10_000),
      );
      return context.json(AdminFaceResultSchema.parse({ indexed, photoId: photoId.data }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PHOTO_NOT_FOUND') throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
      if (error instanceof Error && error.message === 'FACE_SEARCH_DISABLED') throw new ApiException('FACE_SEARCH_DISABLED', 'errors.faceSearchDisabled', 409);
      if (error instanceof Error && error.message === 'FACE_QUOTA_EXCEEDED') throw new ApiException('FACE_QUOTA_EXCEEDED', 'errors.faceQuotaExceeded', 413);
      if (error instanceof Error && error.message === 'FACE_EXPIRY_EXCEEDS_RETENTION') throw new ApiException('FACE_EXPIRY_EXCEEDS_RETENTION', 'errors.invalidFaceExpiry', 400);
      if (error instanceof Error && error.message === 'FACE_EXPIRY_IMMUTABLE') throw new ApiException('FACE_EXPIRY_IMMUTABLE', 'errors.invalidFaceExpiry', 409);
      if (error instanceof Error && error.message === 'FACE_GENERATION_CONFLICT') throw new ApiException('FACE_GENERATION_CONFLICT', 'errors.faceGenerationConflict', 409);
      if (error instanceof Error && error.message === 'PHOTO_FACE_INDEX_UNAVAILABLE') throw new ApiException('PHOTO_FACE_INDEX_UNAVAILABLE', 'errors.faceIndexBusy', 409);
      throw error;
    }
  });

  app.post('/api/v1/events/:eventId/face-search', async (context) => {
    const input = FaceSearchRequestSchema.safeParse(await context.req.json<unknown>().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_FACE_SEARCH', 'errors.invalidFaceSearch', 400);
    const event = await requireSearchableEvent(context, context.req.param('eventId'));
    // Search responses are derived from biometric input and are never shared,
    // even when the underlying event gallery is public.
    applyCachePolicy(context, 'event-protected');
    const vectors = dependencies.vectors(context);
    if (!vectors.available()) throw new ApiException('FACE_INDEX_UNAVAILABLE', 'errors.faceSearchUnavailable', 503);
    const repository = dependencies.repository(context);
    const now = dependencies.now();
    const generation = await repository.currentGeneration(event.id, now);
    if (generation === null) throw new ApiException('FACE_INDEX_EXPIRED', 'errors.faceSearchExpired', 410);
    // Cursor integrity is mandatory even on the first page so a missing frozen
    // secret cannot silently downgrade pagination security.
    const secret = context.env.TURNSTILE_SECRET_KEY;
    if (!secret) throw new ApiException('FACE_CURSOR_SIGNING_UNAVAILABLE', 'errors.faceSearchUnavailable', 503);
    const partitions = await repository.partitions(event.id, generation);
    let nextPartition: number | null;
    let matches: FaceVectorMatch[];
    if (input.data.cursor) {
      const cursor = await verifyFaceSearchCursor(input.data.cursor, secret);
      if (cursor.eventId !== event.id || cursor.generation !== generation || cursor.nextPartition >= partitions.length) {
        throw new ApiException('INVALID_FACE_CURSOR', 'errors.invalidCursor', 400);
      }
      const partitionId = partitions[cursor.nextPartition];
      if (!partitionId) throw new ApiException('INVALID_FACE_CURSOR', 'errors.invalidCursor', 400);
      const query = await vectors.query(input.data.embedding, event.id, generation, partitionId);
      matches = query.matches;
      await repository.recordVectorQuery(now);
      nextPartition = cursor.nextPartition + 1 < partitions.length ? cursor.nextPartition + 1 : null;
    } else {
      const query = await vectors.query(input.data.embedding, event.id, generation);
      matches = query.matches;
      await repository.recordVectorQuery(now);
      nextPartition = query.saturated && partitions.length > 0 ? 0 : null;
    }
    const results = await repository.resultsForMatches(event.id, matches, now);
    const nextCursor = nextPartition === null
      ? null
      : await signFaceSearchCursor({ eventId: event.id, generation, nextPartition }, secret);
    return context.json(FaceSearchResponseSchema.parse({ matches: results, nextCursor }));
  });

  app.get('/api/v1/events/:eventId/photos/:photoId/related', async (context) => {
    const event = await requireSearchableEvent(context, context.req.param('eventId'));
    if (!event.nearbySearchEnabled) throw new ApiException('NEARBY_SEARCH_DISABLED', 'errors.faceSearchDisabled', 409);
    const photoId = IdSchema.safeParse(context.req.param('photoId'));
    if (!photoId.success) throw new ApiException('INVALID_PHOTO_ID', 'errors.invalidPhotoId', 400);
    const photos = await dependencies.repository(context).related(event.id, photoId.data);
    if (!photos) throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
    return context.json(RelatedPhotosResponseSchema.parse({ photos }));
  });

  app.post('/api/v1/admin/events/:eventId/purge-faces', async (context) => {
    requireAdmin(context);
    const eventId = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventId.success) throw new ApiException('INVALID_EVENT_ID', 'errors.invalidEventId', 400);
    const queued = await dependencies.repository(context).enqueuePurge(eventId.data, dependencies.now());
    if (!queued) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    return context.json(PurgeFacesResponseSchema.parse({ queued: true }), 202);
  });
}

export async function enqueueExpiredFacePurges(database: D1Database, now: string): Promise<number> {
  const events = await database.prepare(
    `SELECT DISTINCT event_id FROM faces
      WHERE expires_at IS NOT NULL AND expires_at <= ?1`,
  ).bind(now).all<{ event_id: string }>();
  let queued = 0;
  for (const event of events.results) {
    const active = await database.prepare(
      `SELECT id FROM maintenance_jobs
        WHERE kind = 'purge_expired_faces'
          AND state IN ('pending', 'running')
          AND json_extract(payload_json, '$.eventId') = ?1
        LIMIT 1`,
    ).bind(event.event_id).first();
    if (active) continue;
    const jobId = crypto.randomUUID();
    const inserted = await database.prepare(
      `INSERT INTO maintenance_jobs
       (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'purge_expired_faces', 'pending', ?2, ?3, 0, ?4, ?4, ?4)`,
    ).bind(
      jobId,
      JSON.stringify({ eventId: event.event_id, expiresBefore: now }),
      `purge-expired-faces:${event.event_id}:${now}`,
      now,
    ).run();
    if ((inserted.meta.changes ?? 0) === 1) queued += 1;
  }
  return queued;
}
