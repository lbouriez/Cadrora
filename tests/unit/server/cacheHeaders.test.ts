import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import type { AppEnv, CachePolicy } from '../../../src/server/types';

describe('cacheHeaders middleware', () => {
  it.each<[CachePolicy, string]>([
    ['admin', 'no-store'],
    ['asset', 'public, max-age=31536000, immutable'],
    ['event-protected', 'private, no-store'],
    ['event-public', 'public, max-age=60'],
    ['media-protected', 'private, max-age=3600'],
    ['media-public', 'public, max-age=60, must-revalidate'],
    ['media-download', 'private, no-store'],
  ])('applies %s policy', async (policy, expected) => {
    const app = new Hono<AppEnv>();
    app.use('*', async (context, next) => {
      context.set('cachePolicy', policy);
      await next();
    });
    app.use('*', cacheHeaders);
    app.get('/test', (context) => context.text('ok'));

    expect((await app.request('/test')).headers.get('Cache-Control')).toBe(expected);
  });

  it('fails closed for an unclassified API response', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', cacheHeaders);
    app.get('/api/unknown', (context) => context.text('nope'));

    expect((await app.request('/api/unknown')).headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('recognizes only hashed application assets as immutable', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', cacheHeaders);
    app.get('*', (context) => context.text('asset'));

    expect((await app.request('/assets/app-AbCdEf123.js')).headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect((await app.request('/assets/app.js')).headers.get('Cache-Control')).toBeNull();
  });
});
