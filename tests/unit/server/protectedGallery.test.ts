import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { authContext } from '../../../src/server/middleware/authContext';
import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { ogMetadata } from '../../../src/server/middleware/ogMetadata';
import { requestId } from '../../../src/server/middleware/requestId';
import type { EventRow } from '../../../src/server/routes/public/data';
import { registerPublicRoutes } from '../../../src/server/routes/public';
import type { AppEnv } from '../../../src/server/types';

const protectedEvent: EventRow = {
  id: 'event-1',
  slug: 'private-wedding',
  title: 'Private wedding title',
  description: 'Private wedding description',
  starts_at: '2030-01-01T00:00:00.000Z',
  timezone: 'America/Toronto',
  cover_photo_id: null,
  visibility: 'published',
  access: 'protected',
  allow_downloads: 0,
  face_search_enabled: 0,
  keep_originals: 0,
  retention_days: null,
  revision: 1,
  created_at: '2029-01-01T00:00:00.000Z',
  updated_at: '2029-01-01T00:00:00.000Z',
};

function databaseReturning(row: EventRow): D1Database {
  const statement = {
    bind: vi.fn(),
    first: vi.fn().mockResolvedValue(row),
  };
  statement.bind.mockReturnValue(statement);
  return { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;
}

function bindings(database: D1Database): CloudflareBindings {
  return {
    ADMIN_AUTH_MODE: 'password',
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    DB: database,
    MEDIA_BUCKET: {} as R2Bucket,
    MODELS_BUCKET: {} as R2Bucket,
    MAX_EVENTS: '50',
    MAX_FACES_PER_EVENT: '10000',
    MAX_PHOTOS_PER_EVENT: '2000',
    MAX_STORAGE_BYTES: '10737418240',
    SESSION_TTL_H: '8',
    SITE_DEFAULT_LANG: 'fr',
  };
}

describe('protected gallery metadata', () => {
  it('refuses event metadata before a current grant', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', authContext);
    app.use('*', cacheHeaders);
    registerPublicRoutes(app);

    const response = await app.request(
      '/api/v1/events/private-wedding',
      undefined,
      bindings(databaseReturning(protectedEvent)),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).not.toContain(protectedEvent.title);
  });

  it('redacts protected metadata from crawler shells', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', ogMetadata);

    const response = await app.request(
      '/e/private-wedding',
      { headers: { 'User-Agent': 'ExampleBot/1.0' } },
      bindings(databaseReturning(protectedEvent)),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(html).not.toContain(protectedEvent.title);
    expect(html).not.toContain(protectedEvent.description);
  });
});

