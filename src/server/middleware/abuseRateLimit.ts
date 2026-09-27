import { createMiddleware } from 'hono/factory';

import { apiErrorResponse } from '../http/apiErrorResponse';
import type { AppEnv } from '../types';

const UNLOCK_PATH = /^\/api\/v1\/galleries\/[^/]+\/unlock$/u;
const FACE_SEARCH_PATH = /^\/api\/v1\/galleries\/[^/]+\/face-search$/u;

type LimitedOperation = 'auth' | 'face';

export function limitedOperation(method: string, path: string): LimitedOperation | null {
  if (method.toUpperCase() !== 'POST') return null;
  if (path === '/api/v1/admin/login' || UNLOCK_PATH.test(path)) return 'auth';
  if (FACE_SEARCH_PATH.test(path)) return 'face';
  return null;
}

/** Run before Turnstile so invalid proofs cannot flood Siteverify or expensive face queries. */
export const abuseRateLimit = createMiddleware<AppEnv>(async (context, next) => {
  const operation = limitedOperation(context.req.method, context.req.path);
  if (!operation) { await next(); return; }

  const limiter = operation === 'auth' ? context.env?.AUTH_RATE_LIMITER : context.env?.FACE_RATE_LIMITER;
  if (!limiter) {
    return apiErrorResponse(context, 503, 'RATE_LIMIT_UNAVAILABLE', 'errors.serviceUnavailable');
  }

  // Anonymous endpoints have no durable user identity. Cloudflare provides this header
  // on deployed requests; a missing value intentionally shares one conservative bucket.
  const client = context.req.header('CF-Connecting-IP') ?? 'unknown';
  const key = `${new URL(context.req.url).hostname}:${operation}:${client}`;
  try {
    const result = await limiter.limit({ key });
    if (!result.success) {
      context.header('Retry-After', '60');
      return apiErrorResponse(context, 429, 'RATE_LIMITED', 'errors.rateLimited');
    }
  } catch {
    return apiErrorResponse(context, 503, 'RATE_LIMIT_UNAVAILABLE', 'errors.serviceUnavailable');
  }
  await next();
});
