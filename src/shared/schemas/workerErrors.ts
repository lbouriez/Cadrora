import { z } from '../zod';
import { IsoDateTimeSchema } from './primitives';

export const WorkerErrorSchema = z.object({
  id: z.number().int().positive(),
  occurredAt: IsoDateTimeSchema,
  requestId: z.string().min(1).max(128),
  method: z.string().min(1).max(16),
  routeGroup: z.string().min(1).max(32),
  code: z.string().min(1).max(80),
  category: z.string().min(1).max(32),
}).strict();

export const WorkerErrorListSchema = z.object({
  errors: z.array(WorkerErrorSchema),
  nextBefore: z.number().int().positive().nullable(),
}).strict();

export const WorkerErrorQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
}).strict();
