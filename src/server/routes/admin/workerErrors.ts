import type { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { WorkerErrorQuerySchema } from '../../../shared/schemas/workerErrors';
import { MediaDiagnosticQuerySchema } from '../../../shared/schemas/mediaDiagnostics';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { scanMediaObjects } from '../../services/mediaDiagnostics';
import { listWorkerErrors } from '../../services/workerErrorLog';
import type { AppEnv } from '../../types';

export function registerAdminWorkerErrorRoutes(app: Hono<AppEnv>): void {
  app.get('/api/v1/admin/diagnostics/media', async (context) => {
    const admin = context.get('auth').admin;
    if (!admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
    if (admin.access !== 'manage') throw new ApiException('DEMO_READ_ONLY', 'errors.demoReadOnly', 403);
    applyCachePolicy(context, 'admin');
    const query = MediaDiagnosticQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    return context.json(await scanMediaObjects(context.env.DB, context.env.MEDIA_BUCKET, query.data.scope, query.data.cursor));
  });
  app.get('/api/v1/admin/worker-errors', async (context) => {
    const admin = context.get('auth').admin;
    if (!admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
    if (admin.access !== 'manage') throw new ApiException('DEMO_READ_ONLY', 'errors.demoReadOnly', 403);
    applyCachePolicy(context, 'admin');
    const query = WorkerErrorQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    return context.json(await listWorkerErrors(context.env.DB, query.data.before));
  });
}
