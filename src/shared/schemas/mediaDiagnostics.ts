import { z } from '../zod';
import { IsoDateTimeSchema } from './primitives';

export const MediaDiagnosticScopeSchema = z.enum(['galleries', 'services', 'portfolio']);

export const MediaDiagnosticQuerySchema = z.object({
  scope: MediaDiagnosticScopeSchema,
  cursor: z.string().min(1).max(4_096).optional(),
}).strict();

export const MediaDiagnosticPageSchema = z.object({
  scanned: z.number().int().nonnegative(),
  untracked: z.array(z.object({ key: z.string().min(1).max(1_024), uploadedAt: IsoDateTimeSchema }).strict()),
  nextCursor: z.string().min(1).nullable(),
  pendingCleanupJobs: z.number().int().nonnegative(),
  runningCleanupJobs: z.number().int().nonnegative(),
  failedCleanupJobs: z.number().int().nonnegative(),
}).strict();
