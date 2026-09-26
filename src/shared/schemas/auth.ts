import { z } from '../zod';

import { IdSchema, IsoDateTimeSchema } from './primitives';

export const TurnstileTokenSchema = z.string().min(1).max(2_048);

/** Input for the password-admin login endpoint. The Turnstile proof is verified
 * by middleware before this route receives the password. */
export const AdminLoginInputSchema = z.object({
  account: z.enum(['demo', 'owner']).default('owner'),
  password: z.string().min(1).max(200),
  turnstileToken: TurnstileTokenSchema,
  username: z.string().min(1).max(100).optional(),
});

export const SessionSchema = z.object({
  access: z.enum(['manage', 'read-only']),
  id: IdSchema,
  authMode: z.enum(['password', 'cloudflare-access', 'demo']),
  subject: z.string().min(1).max(320),
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable(),
});

export const EventGrantSchema = z.object({
  eventId: IdSchema,
  accessVersion: z.number().int().positive(),
});

export const AdminSessionResponseSchema = SessionSchema;

export type Session = z.infer<typeof SessionSchema>;
export type EventGrant = z.infer<typeof EventGrantSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;
