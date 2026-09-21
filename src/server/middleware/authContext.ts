import { createMiddleware } from 'hono/factory';

import {
  getPasswordSession,
  readDemoSessionToken,
  readEventGrantToken,
  readSessionToken,
  verifyCloudflareAccessJwt,
  verifyDemoSession,
  verifyEventGrantToken,
} from '../auth';
import type { AppEnv } from '../types';

export const authContext = createMiddleware<AppEnv>(async (context, next) => {
  context.set('auth', {});
  // Unit tests and incomplete local setup intentionally have no bindings. That
  // must resolve to no identity rather than an exception or accidental access.
  const bindings = context.env;

  if (bindings?.ADMIN_AUTH_MODE === 'password' && bindings.DB) {
    const token = readSessionToken(context.req.header('Cookie'));
    if (token) {
      const session = await getPasswordSession(bindings.DB, token);
      if (session) context.set('auth', { admin: session });
    }
    if (!context.get('auth').admin && bindings.DEMO_SHOWCASE_ENABLED === 'true' && bindings.ADMIN_SECRET_HASH) {
      const demoToken = readDemoSessionToken(context.req.header('Cookie'));
      if (demoToken) {
        const session = await verifyDemoSession(demoToken, bindings.ADMIN_SECRET_HASH);
        if (session) context.set('auth', { admin: session });
      }
    }
  } else if (bindings?.ADMIN_AUTH_MODE === 'cloudflare-access') {
    // Access always supplies this assertion to origins. Do not trust a browser
    // cookie fallback: previews and workers.dev must receive identical checks.
    const session = await verifyCloudflareAccessJwt(
      context.req.header('Cf-Access-Jwt-Assertion') ?? undefined,
      bindings.CF_ACCESS_TEAM_DOMAIN,
      bindings.CF_ACCESS_AUD,
    );
    if (session) context.set('auth', { admin: session });
  }

  const grantToken = readEventGrantToken(context.req.header('Cookie'));
  if (grantToken && bindings?.TURNSTILE_SECRET_KEY) {
    const eventGrant = await verifyEventGrantToken(grantToken, bindings.TURNSTILE_SECRET_KEY);
    if (eventGrant) context.set('auth', { ...context.get('auth'), eventGrant });
  }

  await next();
});
