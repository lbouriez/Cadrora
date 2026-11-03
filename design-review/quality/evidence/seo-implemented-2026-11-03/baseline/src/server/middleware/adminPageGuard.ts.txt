import { createMiddleware } from 'hono/factory';

import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

const ADMIN_LOGIN_PATH = '/admin/login';

function isAdminPage(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

/**
 * Protects the SPA's admin navigations once `/admin/*` is Worker-first. Password
 * mode deliberately leaves only its login page reachable without a session;
 * Cloudflare Access mode requires the already verified JWT on every page.
 */
export const adminPageGuard = createMiddleware<AppEnv>(async (context, next) => {
  if (!isAdminPage(context.req.path)) {
    await next();
    return;
  }

  context.header('Cache-Control', 'no-store');
  const mode = context.env?.ADMIN_AUTH_MODE;
  if (mode === 'password' && context.req.path === ADMIN_LOGIN_PATH) {
    await next();
    return;
  }
  if (!context.get('auth').admin) {
    if (mode === 'password') return context.redirect(ADMIN_LOGIN_PATH, 302);
    throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
  }
  await next();
});
