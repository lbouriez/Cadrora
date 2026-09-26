import { z } from '../zod';

export const ApiErrorSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/),
  message: z.string().min(1).max(200),
  requestId: z.string().min(1).max(128),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

