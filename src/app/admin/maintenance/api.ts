import type { z } from '../../../shared/zod';
import { AppLogPageSchema, MaintenanceJobPageSchema, MaintenanceOverviewSchema } from '../../../shared/schemas/maintenance';

async function get<T>(section: string, schema: z.ZodType<T>, params = new URLSearchParams()): Promise<T> {
  const response = await fetch(`/api/v1/admin/maintenance/${section}?${params}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Maintenance returned ${response.status}`);
  return schema.parse(await response.json());
}
export const getMaintenanceOverview = () => get('overview', MaintenanceOverviewSchema);
export const getMaintenanceJobs = (params: URLSearchParams) => get('jobs', MaintenanceJobPageSchema, params);
export const getApplicationLogs = (params: URLSearchParams) => get('logs', AppLogPageSchema, params);
