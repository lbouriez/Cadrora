import { createMiddleware } from 'hono/factory';

import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

/** Require a verified admin identity. Apply it to every future admin route. */
export const requireAdmin = createMiddleware<AppEnv>(async (context, next) => {
  if (!context.get('auth').admin) {
    throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
  }
  context.set('cachePolicy', 'admin');
  await next();
});
