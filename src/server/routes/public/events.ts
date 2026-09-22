import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { ApiException } from '../../../shared/errors/ApiError';
import type { Event, EventGrant } from '../../../shared/schemas';
import {
  PhotoListQuerySchema,
  PublicEventListSchema,
  PublicEventSchema,
  PublicPhotoPageSchema,
  UnlockEventRequestSchema,
  UnlockEventResponseSchema,
} from '../../../shared/schemas/gallery';
import type { AppEnv } from '../../types';
import { readEventGrantToken } from '../../auth';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { currentAccessVersion, hasCurrentEventAccess } from './access';
import { isShowcasePrivateEventPassword, verifyEventPasswordDetailed } from './credentials';
import { eventFromRow, findEvent, isEventAvailable, photosFromRows, toPublicEvent } from './data';
import type { EventRow, PhotoWithVariantRow } from './data';

interface PhotoCursor {
  sortKey: string;
  id: string;
  revision: number;
}

const PhotoCursorSchema = z.object({
  sortKey: z.string().min(1).max(256),
  id: z.string().min(1).max(128),
  revision: z.number().int().nonnegative(),
});

export function encodePhotoCursor(cursor: PhotoCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function decodePhotoCursor(cursor: string): PhotoCursor {
  try {
    const encoded = cursor.replaceAll('-', '+').replaceAll('_', '/');
    const parsed: unknown = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return PhotoCursorSchema.parse(parsed);
  } catch {
    throw new ApiException('INVALID_CURSOR', 'errors.invalidCursor', 400);
  }
}

function validatedJson<T>(context: Context<AppEnv>, schema: z.ZodType<T>, value: unknown): Response {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiException('INVALID_RESPONSE', 'errors.internal', 500);
  return context.json(parsed.data);
}

async function eventAccessError(context: Context<AppEnv>, event: Event): Promise<ApiException> {
  const tokenPresent = readEventGrantToken(context.req.header('Cookie')) !== null;
  const grant = context.get('auth').eventGrant;
  if (!tokenPresent) return new ApiException('EVENT_ACCESS_REQUIRED', 'errors.eventAccessRequired', 401);
  if (!grant) return new ApiException('EVENT_GRANT_INVALID', 'errors.eventAccessRequired', 401);
  if (grant.eventId !== event.id) return new ApiException('EVENT_ACCESS_REQUIRED', 'errors.eventAccessRequired', 401);
  const version = await currentAccessVersion(context.env.DB, event.id);
  if (version === null || grant.accessVersion !== version) {
    return new ApiException('EVENT_GRANT_STALE', 'errors.eventAccessRequired', 401);
  }
  return new ApiException('EVENT_ACCESS_REQUIRED', 'errors.eventAccessRequired', 401);
}

export interface PublicRouteServices {
  issueEventGrant?: (context: Context<AppEnv>, grant: EventGrant) => Promise<void> | void;
  verifyPassword?: (password: string, encodedHash: string) => Promise<boolean>;
}

export function createPublicEventRoutes(services: PublicRouteServices = {}): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/events', async (context) => {
    const result = await context.env.DB.prepare(
      `SELECT * FROM events
       WHERE visibility = 'published' AND offline_at IS NULL AND access = 'public'
       ORDER BY starts_at DESC, id ASC`,
    ).all<EventRow>();
    applyCachePolicy(context, 'event-public');
    return validatedJson(context, PublicEventListSchema, {
      events: result.results.map((row) => toPublicEvent(eventFromRow(row))),
    });
  });

  routes.get('/events/:eventId', async (context) => {
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event || !isEventAvailable(event)) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (!(await hasCurrentEventAccess(context, event))) {
      applyCachePolicy(context, 'event-protected');
      throw await eventAccessError(context, event);
    }
    applyCachePolicy(context, event.access === 'public' ? 'event-public' : 'event-protected');
    context.header('ETag', `"event-${event.id}-${event.revision}"`);
    context.header('X-Cadrora-Revision', String(event.revision));
    return validatedJson(context, PublicEventSchema, toPublicEvent(event));
  });

  routes.post('/events/:eventId/unlock', async (context) => {
    const body = UnlockEventRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!body.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event || !isEventAvailable(event)) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (event.access !== 'protected') throw new ApiException('EVENT_NOT_PROTECTED', 'errors.eventNotProtected', 409);
    const credential = await context.env.DB.prepare(
      'SELECT password_hash, access_version FROM event_credentials WHERE event_id = ?1',
    ).bind(event.id).first<{ password_hash: string; access_version: number }>();
    if (!credential) {
      throw new ApiException('EVENT_PASSWORD_UNAVAILABLE', 'errors.serviceUnavailable', 503);
    }
    const verification = isShowcasePrivateEventPassword(event.id, body.data.password, context.env.DEMO_SHOWCASE_ENABLED)
      ? 'valid'
      : services.verifyPassword
        ? await services.verifyPassword(body.data.password, credential.password_hash) ? 'valid' : 'mismatch'
        : await verifyEventPasswordDetailed(body.data.password, credential.password_hash, context.env.AUTH_PEPPER);
    if (verification === 'invalid-hash' || verification === 'missing-pepper' || verification === 'crypto-error') {
      throw new ApiException('EVENT_PASSWORD_UNAVAILABLE', 'errors.serviceUnavailable', 503);
    }
    if (verification !== 'valid') {
      throw new ApiException('INVALID_EVENT_PASSWORD', 'errors.invalidEventPassword', 401);
    }
    if (!services.issueEventGrant) {
      throw new ApiException('EVENT_GRANT_UNAVAILABLE', 'errors.serviceUnavailable', 503);
    }
    await services.issueEventGrant(context, { eventId: event.id, accessVersion: credential.access_version });
    applyCachePolicy(context, 'event-protected');
    return validatedJson(context, UnlockEventResponseSchema, { unlocked: true });
  });

  routes.get('/events/:eventId/photos', async (context) => {
    const query = PhotoListQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event || !isEventAvailable(event)) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    if (!(await hasCurrentEventAccess(context, event))) {
      applyCachePolicy(context, 'event-protected');
      throw await eventAccessError(context, event);
    }
    applyCachePolicy(context, event.access === 'public' ? 'event-public' : 'event-protected');
    context.header('ETag', `"event-${event.id}-${event.revision}-photos"`);
    context.header('X-Cadrora-Revision', String(event.revision));

    const cursor = query.data.cursor ? decodePhotoCursor(query.data.cursor) : null;
    if (cursor && cursor.revision !== event.revision) {
      throw new ApiException('STALE_CURSOR', 'errors.staleCursor', 409);
    }
    const pageSize = query.data.limit;
    const idsQuery = cursor
      ? context.env.DB.prepare(
          `SELECT id, sort_key FROM photos
           WHERE event_id = ?1 AND state = 'published'
             AND (sort_key > ?2 OR (sort_key = ?2 AND id > ?3))
           ORDER BY sort_key ASC, id ASC LIMIT ?4`,
        ).bind(event.id, cursor.sortKey, cursor.id, pageSize + 1)
      : context.env.DB.prepare(
          `SELECT id, sort_key FROM photos
           WHERE event_id = ?1 AND state = 'published'
           ORDER BY sort_key ASC, id ASC LIMIT ?2`,
        ).bind(event.id, pageSize + 1);
    const idResult = await idsQuery.all<{ id: string; sort_key: string }>();
    const hasMore = idResult.results.length > pageSize;
    const pageRows = idResult.results.slice(0, pageSize);
    if (pageRows.length === 0) {
      return validatedJson(context, PublicPhotoPageSchema, {
        eventRevision: event.revision,
        photos: [],
        nextCursor: null,
      });
    }
    const placeholders = pageRows.map(() => '?').join(', ');
    const variantResult = await context.env.DB.prepare(
      `SELECT p.id, p.event_id, p.filename, p.width, p.height, p.captured_at,
              p.sort_key, p.revision, v.variant, v.content_type,
              v.width AS variant_width, v.height AS variant_height
       FROM photos p JOIN photo_variants v ON v.photo_id = p.id
       WHERE p.id IN (${placeholders})
       ORDER BY p.sort_key ASC, p.id ASC, v.width ASC`,
    ).bind(...pageRows.map((row) => row.id)).all<PhotoWithVariantRow>();
    const photos = photosFromRows(variantResult.results, event.allowDownloads);
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last
      ? encodePhotoCursor({ sortKey: last.sort_key, id: last.id, revision: event.revision })
      : null;
    return validatedJson(context, PublicPhotoPageSchema, {
      eventRevision: event.revision,
      photos,
      nextCursor,
    });
  });

  return routes;
}

export { currentAccessVersion };
