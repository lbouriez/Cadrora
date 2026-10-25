import type { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ApiException } from '../../../shared/errors/ApiError';
import { AppLogQuerySchema, MaintenanceJobQuerySchema, MaintenanceOverviewQuerySchema } from '../../../shared/schemas/maintenance';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { listAppLogs } from '../../services/appLog';
import { listMaintenanceJobs, maintenanceOverview } from '../../services/maintenanceStatus';
import type { AppEnv } from '../../types';

export function registerMaintenanceRoutes(app: Hono<AppEnv>): void {
  app.use('/api/v1/admin/maintenance/*', createMiddleware<AppEnv>(async (context, next) => {
    const admin = context.get('auth').admin;
    if (!admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
    if (admin.access !== 'manage') throw new ApiException('DEMO_READ_ONLY', 'errors.demoReadOnly', 403);
    applyCachePolicy(context, 'admin');
    await next();
  }));
  app.get('/api/v1/admin/maintenance/overview', async (context) => {
    if (!MaintenanceOverviewQuerySchema.safeParse(context.req.query()).success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    return context.json(await maintenanceOverview(context.env.DB));
  });
  app.get('/api/v1/admin/maintenance/jobs', async (context) => {
    const query = MaintenanceJobQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    return context.json(await listMaintenanceJobs(context.env.DB, query.data));
  });
  app.get('/api/v1/admin/maintenance/logs', async (context) => {
    const query = AppLogQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    return context.json(await listAppLogs(context.env.DB, query.data));
  });
}
