import { createMiddleware } from 'hono/factory';

import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function hasSameOrigin(requestUrl: string, origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    // Origin is serialized as scheme/host/port only. Reject values that merely
    // share an origin after URL parsing but are not valid Origin header values.
    return origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Origin CSRF protection for an admin router. Mount this middleware only below
 * `/api/v1/admin`; it rejects every state-changing method without a same-origin
 * browser Origin header.
 */
export const adminCsrf = createMiddleware<AppEnv>(async (context, next) => {
  if (!SAFE_METHODS.has(context.req.method.toUpperCase()) && !hasSameOrigin(context.req.url, context.req.header('Origin'))) {
    throw new ApiException('ADMIN_ORIGIN_REQUIRED', 'errors.adminOriginRequired', 403);
  }
  await next();
});
