import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, SlugSchema } from './primitives';

export const EventVisibilitySchema = z.enum(['draft', 'published', 'unlisted']);
export const EventAccessSchema = z.enum(['public', 'protected']);

export const EventSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(5_000).nullable(),
  startsAt: IsoDateTimeSchema,
  timezone: z.string().min(1).max(100),
  coverPhotoId: IdSchema.nullable(),
  visibility: EventVisibilitySchema,
  access: EventAccessSchema,
  allowDownloads: z.boolean(),
  faceSearchEnabled: z.boolean(),
  nearbySearchEnabled: z.boolean(),
  showPhotoMetadata: z.boolean(),
  keepOriginals: z.boolean(),
  retentionDays: z.number().int().positive().nullable(),
  offlineAt: IsoDateTimeSchema.nullable(),
  deletingAt: IsoDateTimeSchema.nullable(),
  revision: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const EventCredentialsSchema = z.object({
  eventId: IdSchema,
  passwordHash: z.string().min(1),
  accessVersion: z.number().int().positive(),
  updatedAt: IsoDateTimeSchema,
});

export type Event = z.infer<typeof EventSchema>;
export type EventCredentials = z.infer<typeof EventCredentialsSchema>;
