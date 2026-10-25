import { z } from '../zod';
import { IdSchema, IsoDateTimeSchema } from './primitives';

export const APP_LOG_RETENTION_DAYS = 90;
export const MaintenanceOverviewQuerySchema = z.object({}).strict();
export const MaintenanceKindSchema = z.enum(['delete_face_vector', 'delete_photo_media', 'delete_gallery',
  'delete_gallery_originals', 'delete_replaced_media', 'delete_service_media', 'delete_portfolio_media',
  'purge_event_faces', 'purge_expired_faces', 'reconcile_usage', 'purge_gallery_cache']);
export type MaintenanceKind = z.infer<typeof MaintenanceKindSchema>;
export const JobStateSchema = z.enum(['pending', 'running', 'failed', 'completed']);
export const LogLevelSchema = z.enum(['info', 'warn', 'error']);
export const LogSourceSchema = z.enum(['http', 'maintenance', 'scheduler']);
const SafeReferenceSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);

// No free-form message, exception, URL, payload or arbitrary metadata field.
export const AppLogInputSchema = z.object({
  level: LogLevelSchema, source: LogSourceSchema,
  code: z.string().min(1).max(80).regex(/^[A-Z][A-Z0-9_]*$/),
  category: z.enum(['api', 'd1-quota', 'type', 'syntax', 'unexpected', 'maintenance', 'scheduler']),
  requestId: SafeReferenceSchema,
  method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'SCHEDULED', 'OTHER']),
  routeGroup: z.enum(['admin-api', 'gallery-api', 'public-api', 'gallery-media', 'service-media', 'portfolio-media', 'maintenance', 'other']),
  jobId: SafeReferenceSchema.nullable().default(null),
  jobKind: MaintenanceKindSchema.nullable().default(null),
}).strict();
export type AppLogInput = z.input<typeof AppLogInputSchema>;
export const AppLogSchema = AppLogInputSchema.extend({ id: z.number().int().positive(), occurredAt: IsoDateTimeSchema });
export const AppLogQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(), level: LogLevelSchema.optional(), source: LogSourceSchema.optional(),
}).strict();
export const AppLogPageSchema = z.object({ logs: z.array(AppLogSchema).max(50), nextBefore: z.number().int().positive().nullable(), retentionDays: z.literal(APP_LOG_RETENTION_DAYS) }).strict();

export const MaintenanceJobCursorSchema = z.object({ createdAt: IsoDateTimeSchema, id: IdSchema }).strict();
export const MaintenanceJobQuerySchema = z.object({
  state: z.enum(['active', 'pending', 'running', 'failed', 'completed']).default('active'),
  beforeCreatedAt: IsoDateTimeSchema.optional(), beforeId: IdSchema.optional(),
}).strict().refine((value) => Boolean(value.beforeCreatedAt) === Boolean(value.beforeId), { message: 'Both cursor fields are required.' });
export const MaintenanceJobSchema = z.object({
  id: IdSchema, kind: MaintenanceKindSchema, state: JobStateSchema,
  attempts: z.number().int().nonnegative(), availableAt: IsoDateTimeSchema, createdAt: IsoDateTimeSchema, updatedAt: IsoDateTimeSchema,
  galleryId: IdSchema.nullable(), hasError: z.boolean(), leaseExpired: z.boolean(),
}).strict();
export const MaintenanceJobPageSchema = z.object({ jobs: z.array(MaintenanceJobSchema).max(50), nextCursor: MaintenanceJobCursorSchema.nullable() }).strict();
export const MaintenanceRunSchema = z.object({
  startedAt: IsoDateTimeSchema, finishedAt: IsoDateTimeSchema.nullable(),
  state: z.enum(['running', 'completed', 'failed']), processed: z.number().int().nonnegative(),
}).strict();
export const MaintenanceOverviewSchema = z.object({
  observedAt: IsoDateTimeSchema, retentionDays: z.literal(APP_LOG_RETENTION_DAYS),
  lastRun: MaintenanceRunSchema.nullable(), lastSuccessAt: IsoDateTimeSchema.nullable(),
  counts: z.object({ pending: z.number().int().nonnegative(), running: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), staleRunning: z.number().int().nonnegative() }).strict(),
}).strict();
