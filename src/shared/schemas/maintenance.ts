import { z } from '../zod';

import { IdSchema, IsoDateTimeSchema } from './primitives';

export const MaintenanceJobSchema = z.object({
  id: IdSchema,
  kind: z.enum(['delete_face_vector', 'delete_photo_media', 'purge_event_faces', 'purge_expired_faces', 'reconcile_usage']),
  state: z.enum(['pending', 'running', 'completed', 'failed']),
  payload: z.record(z.string(), z.unknown()),
  attempts: z.number().int().nonnegative(),
  availableAt: IsoDateTimeSchema,
  lastError: z.string().max(2_000).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type MaintenanceJob = z.infer<typeof MaintenanceJobSchema>;
