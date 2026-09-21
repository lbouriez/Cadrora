import { Hono } from 'hono';

import { eventGrantCookie } from './auth';
import { ApiException } from '../shared/errors/ApiError';
import { apiErrorResponse } from './http/apiErrorResponse';
import {
  adminCsrf,
  adminPageGuard,
  authContext,
  cacheHeaders,
  demoReadOnly,
  errorBoundary,
  rateLimit,
  requestId,
  securityHeaders,
  turnstile,
} from './middleware';
import { ogMetadata } from './middleware/ogMetadata';
import { runMaintenance } from './maintenance';
import { registerAdminEventRoutes } from './routes/admin/events';
import { adminAuthRouter } from './routes/admin/auth';
import { registerAdminImportRoutes } from './routes/admin/imports';
import { registerPublicationRoutes } from './routes/admin/publication';
import { registerFaceModelRoutes } from './routes/faceModels';
import { registerFaceSearchRoutes } from './routes/faceSearch';
import { enqueueExpiredFacePurges } from './routes/faceSearch';
import { registerMediaRoutes } from './routes/media';
import { registerPublicRoutes } from './routes/public';
import type { AppEnv } from './types';

export const app = new Hono<AppEnv>();

// Frozen order: requestId -> errorBoundary -> securityHeaders -> authContext ->
// turnstile -> rateLimit -> routes -> cacheHeaders.
app.use('*', requestId);
app.onError(errorBoundary);
app.use('*', securityHeaders);
app.use('*', authContext);
app.use('*', adminPageGuard);
app.use('*', turnstile);
app.use('*', rateLimit);
app.use('*', ogMetadata);

// Registered before route handlers so its post-next phase runs after them.
app.use('*', cacheHeaders);

// Every admin mutation, including feature-package routes, is same-origin only.
app.use('/api/v1/admin/*', adminCsrf);
app.use('/api/v1/admin/*', demoReadOnly);

// Feature routes are registered centrally so middleware and authorization order stay reviewable.
app.route('/api/v1/admin', adminAuthRouter);
registerPublicRoutes(app, {
  issueEventGrant: async (context, grant) => {
    const secret = context.env.TURNSTILE_SECRET_KEY;
    if (!secret) throw new ApiException('EVENT_GRANT_UNAVAILABLE', 'errors.serviceUnavailable', 503);
    context.header(
      'Set-Cookie',
      await eventGrantCookie(grant, secret, context.env.SESSION_TTL_H),
    );
  },
});
registerAdminEventRoutes(app);
registerAdminImportRoutes(app);
registerMediaRoutes(app);
registerPublicationRoutes(app);
registerFaceSearchRoutes(app);
registerFaceModelRoutes(app);

app.notFound((context) => {
  if (context.req.path.startsWith('/api/') || context.req.path.startsWith('/media/')) {
    return apiErrorResponse(context, 404, 'ROUTE_NOT_FOUND', 'errors.routeNotFound');
  }
  if (context.env?.ASSETS) return context.env.ASSETS.fetch(context.req.raw);
  return apiErrorResponse(context, 404, 'ROUTE_NOT_FOUND', 'errors.routeNotFound');
});

const worker: ExportedHandler<CloudflareBindings> = {
  fetch: (request, bindings, executionContext) => app.fetch(request, bindings, executionContext),
  scheduled: (_controller, bindings, executionContext) => {
    executionContext.waitUntil((async () => {
      await enqueueExpiredFacePurges(bindings.DB, new Date().toISOString());
      await runMaintenance(bindings, 25);
    })());
  },
};

export default worker;
