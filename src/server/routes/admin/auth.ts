import { Hono } from 'hono';

import {
  createPasswordSession,
  createDemoSession,
  demoSessionCookie,
  expiredDemoSessionCookie,
  expiredSessionCookie,
  isAuthPepper,
  isPasswordHashFormat,
  revokePasswordSession,
  rotatePasswordSession,
  sessionCookie,
  verifyPassword,
} from '../../auth';
import { ApiException } from '../../../shared/errors/ApiError';
import { AdminLoginInputSchema, AdminSessionResponseSchema } from '../../../shared/schemas';
import {
  adminCsrf,
  clearFailedLogins,
  loginClientKey,
  loginRateLimit,
  recordFailedLogin,
  requireAdmin,
} from '../../middleware';
import type { AppEnv } from '../../types';

interface AdminAuthRouteDependencies {
  createSession: typeof createPasswordSession;
  now: () => Date;
  revokeSession: typeof revokePasswordSession;
  rotateSession: typeof rotatePasswordSession;
  verifyConfiguredPassword: typeof verifyPassword;
}

const defaultDependencies: AdminAuthRouteDependencies = {
  createSession: createPasswordSession,
  now: () => new Date(),
  revokeSession: revokePasswordSession,
  rotateSession: rotatePasswordSession,
  verifyConfiguredPassword: verifyPassword,
};

export function createAdminAuthRouter(
  dependencies: AdminAuthRouteDependencies = defaultDependencies,
): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  // The parent must mount this only at /api/v1/admin. Keeping CSRF here makes
  // login, logout, and every future route state change fail closed by default.
  router.use('*', adminCsrf);

  router.post('/login', loginRateLimit, async (context) => {
    const input = AdminLoginInputSchema.safeParse(await context.req.json<unknown>().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_LOGIN_INPUT', 'errors.invalidLoginInput', 400);
    if (context.env.ADMIN_AUTH_MODE !== 'password') {
      throw new ApiException('PASSWORD_LOGIN_DISABLED', 'errors.passwordLoginDisabled', 403);
    }
    const adminSecretHash = context.env.ADMIN_SECRET_HASH;
    const authPepper = context.env.AUTH_PEPPER;
    if (typeof adminSecretHash !== 'string' || !isPasswordHashFormat(adminSecretHash) || !isAuthPepper(authPepper)) {
      throw new ApiException('ADMIN_AUTH_NOT_CONFIGURED', 'errors.adminAuthNotConfigured', 503);
    }

    const client = loginClientKey(context, input.data.account);
    if (input.data.account === 'demo') {
      if (context.env.DEMO_SHOWCASE_ENABLED !== 'true') {
        throw new ApiException('INVALID_CREDENTIALS', 'errors.invalidCredentials', 401);
      }
      const usernameValid = Boolean(context.env.DEMO_ADMIN_USERNAME)
        && input.data.username === context.env.DEMO_ADMIN_USERNAME;
      const passwordValid = Boolean(context.env.DEMO_ADMIN_PASSWORD)
        && input.data.password === context.env.DEMO_ADMIN_PASSWORD;
      if (!usernameValid || !passwordValid) {
        recordFailedLogin(client, dependencies.now().getTime());
        throw new ApiException('INVALID_CREDENTIALS', 'errors.invalidCredentials', 401);
      }
      const created = await createDemoSession(authPepper, dependencies.now());
      clearFailedLogins(client);
      context.set('cachePolicy', 'admin');
      context.header('Set-Cookie', demoSessionCookie(created.token, created.session.expiresAt, dependencies.now()));
      context.header('Set-Cookie', expiredSessionCookie(), { append: true });
      return context.json(AdminSessionResponseSchema.parse(created.session));
    }

    const passwordValid = await dependencies.verifyConfiguredPassword(input.data.password, adminSecretHash, authPepper);
    if (!passwordValid) {
      recordFailedLogin(client, dependencies.now().getTime());
      throw new ApiException('INVALID_CREDENTIALS', 'errors.invalidCredentials', 401);
    }

    const created = await dependencies.createSession(
      context.env.DB,
      context.env.SESSION_TTL_H,
      'admin',
      dependencies.now(),
    );
    if (!created) throw new ApiException('ADMIN_AUTH_NOT_CONFIGURED', 'errors.adminAuthNotConfigured', 503);

    clearFailedLogins(client);
    context.set('cachePolicy', 'admin');
    context.header('Set-Cookie', sessionCookie(created.token, created.session.expiresAt, dependencies.now()));
    context.header('Set-Cookie', expiredDemoSessionCookie(), { append: true });
    return context.json(AdminSessionResponseSchema.parse(created.session));
  });

  router.post('/logout', requireAdmin, async (context) => {
    const session = context.get('auth').admin;
    if (session?.authMode === 'password') {
      await dependencies.revokeSession(context.env.DB, session.id, dependencies.now());
      context.header('Set-Cookie', expiredSessionCookie());
      context.header('Set-Cookie', expiredDemoSessionCookie(), { append: true });
    } else if (session?.authMode === 'demo') {
      context.header('Set-Cookie', expiredDemoSessionCookie());
      context.header('Set-Cookie', expiredSessionCookie(), { append: true });
    }
    return context.body(null, 204);
  });

  router.get('/session', requireAdmin, async (context) => {
    const current = context.get('auth').admin;
    if (!current) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
    if (current.authMode !== 'password') return context.json(AdminSessionResponseSchema.parse(current));

    const rotated = await dependencies.rotateSession(context.env.DB, current, context.env.SESSION_TTL_H, dependencies.now());
    if (!rotated) {
      context.header('Set-Cookie', expiredSessionCookie());
      throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
    }
    context.header('Set-Cookie', sessionCookie(rotated.token, rotated.session.expiresAt, dependencies.now()));
    return context.json(AdminSessionResponseSchema.parse(rotated.session));
  });

  return router;
}

export const adminAuthRouter = createAdminAuthRouter();
