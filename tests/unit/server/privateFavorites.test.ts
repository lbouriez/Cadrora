import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { createPublicEventRoutes } from '../../../src/server/routes/public/galleries';
import type { AppEnv } from '../../../src/server/types';

const event = {
  id: 'gallery-1', slug: 'private-gallery', title: 'Private gallery', description: null,
  starts_at: '2030-01-01T00:00:00.000Z', timezone: 'UTC', cover_photo_id: null,
  visibility: 'published', access: 'protected', allow_downloads: 0,
  face_search_enabled: 0, nearby_search_enabled: 0, show_photo_metadata: 0, keep_originals: 0,
  retention_days: null, offline_at: null, deleting_at: null, revision: 1,
  created_at: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z',
};

function harness(options: { access?: 'protected' | 'public'; grant?: boolean; offline?: boolean } = {}) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  let liked = 0;
  const prepare = vi.fn((sql: string) => {
    const record = { sql, values: [] as unknown[] };
    statements.push(record);
    const statement = {
      bind: (...values: unknown[]) => { record.values = values; return statement; },
      first: () => Promise.resolve(sql.startsWith('SELECT * FROM events')
        ? { ...event, access: options.access ?? 'protected', offline_at: options.offline ? event.created_at : null }
        : sql.startsWith('SELECT access_version') ? { access_version: 2 }
        : sql.includes('UPDATE photos SET liked') ? (() => { liked = Number(record.values[0]); return { liked }; })()
        : null),
    };
    return statement;
  });
  const app = new Hono<AppEnv>();
  app.use('*', async (context, next) => {
    context.set('requestId', 'favorite-test');
    context.set('auth', options.grant === false ? {} : { eventGrant: { eventId: event.id, accessVersion: 2 } });
    await next();
  });
  app.onError(errorBoundary);
  app.route('/api/v1', createPublicEventRoutes());
  const env = { DB: { prepare } as unknown as D1Database } as CloudflareBindings;
  const request = (body: unknown, origin = 'http://localhost') => app.request('/api/v1/galleries/private-gallery/photos/photo-1/favorite', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  }, env);
  return { request, statements, value: () => liked };
}

describe('private gallery shared favorites', () => {
  it('sets and clears one shared D1 boolean without a visitor identity or count', async () => {
    const test = harness();
    const liked = await test.request({ liked: true });
    expect(liked.status).toBe(200);
    await expect(liked.json()).resolves.toEqual({ liked: true });
    expect(liked.headers.get('Cache-Control')).toBe('private, no-store');
    expect(test.value()).toBe(1);
    expect(test.statements.find(({ sql }) => sql.includes('UPDATE photos SET liked'))?.values.slice(2)).toEqual(['photo-1', event.id, 2]);
    expect(test.statements.find(({ sql }) => sql.includes('UPDATE photos SET liked'))?.sql).toContain("state = 'published'");
    expect(test.statements.find(({ sql }) => sql.includes('UPDATE photos SET liked'))?.sql).toContain("access = 'protected'");
    const unliked = await test.request({ liked: false });
    await expect(unliked.json()).resolves.toEqual({ liked: false });
    expect(test.value()).toBe(0);
  });

  it('rejects public and offline galleries, missing grants, and cross-origin writes', async () => {
    for (const options of [{ access: 'public' as const }, { offline: true }, { grant: false }]) {
      const test = harness(options);
      expect((await test.request({ liked: true })).status).toBe(options.grant === false ? 401 : 404);
      expect(test.statements.some(({ sql }) => sql.includes('UPDATE photos SET liked'))).toBe(false);
    }
    const crossOrigin = harness();
    expect((await crossOrigin.request({ liked: true }, 'https://elsewhere.example')).status).toBe(403);
    expect(crossOrigin.statements).toHaveLength(0);
  });

  it('validates the exact boolean request contract', async () => {
    const test = harness();
    expect((await test.request({ liked: 1 })).status).toBe(400);
    expect((await test.request({ liked: true, extra: true })).status).toBe(400);
    expect(test.statements).toHaveLength(0);
  });
});
