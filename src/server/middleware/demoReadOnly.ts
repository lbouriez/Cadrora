import { createMiddleware } from 'hono/factory';

import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

const SAFE_DEMO_GET_PATHS = [
  /^\/api\/v1\/admin\/session$/u,
  /^\/api\/v1\/admin\/site$/u,
  /^\/api\/v1\/admin\/events$/u,
  /^\/api\/v1\/admin\/events\/[^/]+\/publication$/u,
  /^\/api\/v1\/admin\/usage$/u,
];

function isAllowedDemoRequest(method: string, path: string): boolean {
  if (method === 'POST' && (path === '/api/v1/admin/login' || path === '/api/v1/admin/logout')) return true;
  return method === 'GET' && SAFE_DEMO_GET_PATHS.some((pattern) => pattern.test(path));
}

/**
 * Fail-closed capability boundary for the published demo identity. The exact
 * read allowlist is deliberately narrower than HTTP safe-method semantics so
 * a future GET route cannot accidentally become available to demo sessions.
 */
export const demoReadOnly = createMiddleware<AppEnv>(async (context, next) => {
  const session = context.get('auth').admin;
  if (session?.access === 'read-only' && !isAllowedDemoRequest(context.req.method, context.req.path)) {
    throw new ApiException('DEMO_READ_ONLY', 'errors.demoReadOnly', 403);
  }
  await next();
});
