import { z } from '../zod';

import { IdSchema, IsoDateTimeSchema, SlugSchema } from './primitives';

export const EventVisibilitySchema = z.enum(['draft', 'published', 'unlisted']);
export const EventAccessSchema = z.enum(['public', 'protected']);
export const GalleryServiceSchema = z.enum(['wedding', 'family', 'portrait', 'maternity', 'brand', 'work', 'kids', 'events', 'other']);
export const EventLocalizedCopySchema = z.object({
  fr: z.object({ title: z.string().min(1).max(160), description: z.string().max(5_000).nullable() }).strict(),
  en: z.object({ title: z.string().min(1).max(160), description: z.string().max(5_000).nullable() }).strict(),
}).strict();

export const EventSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(5_000).nullable(),
  localizedCopy: EventLocalizedCopySchema.nullable().optional(),
  service: GalleryServiceSchema.nullable(),
  startsAt: IsoDateTimeSchema,
  timezone: z.string().min(1).max(100),
  coverPhotoId: IdSchema.nullable(),
  visibility: EventVisibilitySchema,
  access: EventAccessSchema,
  allowDownloads: z.boolean(),
  faceSearchEnabled: z.boolean(),
  nearbySearchEnabled: z.boolean(),
  showPhotoMetadata: z.boolean(),
  retouchSelectionEnabled: z.boolean(),
  showOnGalleryPage: z.boolean(),
  keepOriginals: z.boolean(),
  retentionDays: z.number().int().positive().nullable(),
  offlineAt: IsoDateTimeSchema.nullable(),
  deletingAt: IsoDateTimeSchema.nullable(),
  revision: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  retouchSelectionCount: z.number().int().nonnegative().optional(),
});

export const EventCredentialsSchema = z.object({
  eventId: IdSchema,
  passwordHash: z.string().min(1),
  accessVersion: z.number().int().positive(),
  updatedAt: IsoDateTimeSchema,
});

export type Event = z.infer<typeof EventSchema>;
export type EventCredentials = z.infer<typeof EventCredentialsSchema>;
