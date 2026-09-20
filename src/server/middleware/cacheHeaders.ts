import { createMiddleware } from 'hono/factory';

import type { Context } from 'hono';

import type { AppEnv, CachePolicy } from '../types';

export const CACHE_CONTROL_BY_POLICY: Record<CachePolicy, string> = {
  admin: 'no-store',
  asset: 'public, max-age=31536000, immutable',
  'event-protected': 'private, no-store',
  'event-public': 'public, max-age=60',
  'media-protected': 'private, max-age=3600',
  'media-public': 'public, max-age=31536000, immutable',
};

export function applyCachePolicy(context: Context<AppEnv>, policy: CachePolicy): void {
  context.set('cachePolicy', policy);
  context.header('Cache-Control', CACHE_CONTROL_BY_POLICY[policy]);
}

export const cacheHeaders = createMiddleware<AppEnv>(async (context, next) => {
  await next();

  const policy = context.get('cachePolicy');
  if (policy) {
    applyCachePolicy(context, policy);
    return;
  }

  if (context.req.path.startsWith('/api/v1/admin/')) {
    context.header('Cache-Control', CACHE_CONTROL_BY_POLICY.admin);
  } else if (/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/u.test(context.req.path)) {
    context.header('Cache-Control', CACHE_CONTROL_BY_POLICY.asset);
  } else if (context.req.path.startsWith('/api/') || context.req.path.startsWith('/media/')) {
    // Unknown or missing event classification is always private/fail-closed.
    context.header('Cache-Control', 'private, no-store');
  }
});
