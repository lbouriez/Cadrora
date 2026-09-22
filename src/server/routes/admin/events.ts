import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { EventSchema } from '../../../shared/schemas/event';
import {
  AdminEventListSchema,
  CreateEventRequestSchema,
  UpdateEventRequestSchema,
} from '../../../shared/schemas/gallery';
import type { AppEnv } from '../../types';
import { isAuthPepper } from '../../auth';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { hashEventPassword } from '../public/credentials';
import { eventFromRow, findEvent } from '../public/data';
import type { EventRow } from '../public/data';

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

function requiredPositiveLimit(value: string | undefined, name: string): number {
  if (!value || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, {
      cause: new Error(`${name} is invalid`),
    });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, {
      cause: new Error(`${name} is unsafe`),
    });
  }
  return parsed;
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

export function createAdminEventRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/events', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const result = await context.env.DB.prepare('SELECT * FROM events ORDER BY starts_at DESC, id ASC').all<EventRow>();
    const output = AdminEventListSchema.safeParse({ events: result.results.map(eventFromRow) });
    if (!output.success) throw new ApiException('INVALID_RESPONSE', 'errors.internal', 500);
    return context.json(output.data);
  });

  routes.post('/events', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = CreateEventRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const maximumEvents = requiredPositiveLimit(context.env.MAX_EVENTS, 'MAX_EVENTS');
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

  routes.patch('/events/:eventId', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = UpdateEventRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    const nextFaceSearchEnabled = input.data.faceSearchEnabled ?? event.faceSearchEnabled;
    const nextNearbySearchEnabled = input.data.nearbySearchEnabled ?? event.nearbySearchEnabled;
    if (nextNearbySearchEnabled && !nextFaceSearchEnabled) {
      throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
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
    if (input.data.keepOriginals !== undefined) add('keep_originals', Number(input.data.keepOriginals));
    if (input.data.retentionDays !== undefined) add('retention_days', input.data.retentionDays);
    const now = new Date().toISOString();
    if (input.data.coverPhotoId !== undefined && input.data.coverPhotoId !== null) {
      const cover = await context.env.DB.prepare(
        "SELECT id FROM photos WHERE id = ?1 AND event_id = ?2 AND state NOT IN ('deleting', 'deleted')",
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

  routes.delete('/events/:eventId', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const event = await findEvent(context.env.DB, context.req.param('eventId'));
    if (!event) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    const remaining = await context.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM photos WHERE event_id = ?1 AND state != 'deleted'",
    ).bind(event.id).first<{ total: number }>();
    if ((remaining?.total ?? 0) > 0) {
      throw new ApiException('EVENT_NOT_EMPTY', 'errors.eventNotEmpty', 409);
    }
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM event_credentials WHERE event_id = ?1').bind(event.id),
      context.env.DB.prepare('DELETE FROM events WHERE id = ?1').bind(event.id),
    ]);
    return context.body(null, 204);
  });

  return routes;
}

export function registerAdminEventRoutes(app: Hono<AppEnv>): void {
  app.route('/api/v1/admin', createAdminEventRoutes());
}
