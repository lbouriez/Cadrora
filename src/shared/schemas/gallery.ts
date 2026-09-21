import { z } from 'zod';

import { EventAccessSchema, EventSchema, EventVisibilitySchema } from './event';
import { IdSchema, IsoDateTimeSchema, SlugSchema } from './primitives';

export const PublicEventSchema = EventSchema.pick({
  id: true,
  slug: true,
  title: true,
  description: true,
  startsAt: true,
  timezone: true,
  coverPhotoId: true,
  visibility: true,
  access: true,
  allowDownloads: true,
  faceSearchEnabled: true,
  nearbySearchEnabled: true,
  showPhotoMetadata: true,
  retentionDays: true,
  revision: true,
  updatedAt: true,
});

export const PublicEventListSchema = z.object({
  events: z.array(PublicEventSchema),
});

export const AdminEventListSchema = z.object({
  events: z.array(EventSchema),
});

export const PhotoSourceSchema = z.object({
  url: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.enum(['image/jpeg', 'image/webp']),
});

export const PublicPhotoSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  filename: z.string().min(1).max(512),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  capturedAt: IsoDateTimeSchema.nullable(),
  sortKey: z.string().min(1).max(256),
  revision: z.number().int().nonnegative(),
  sources: z.array(PhotoSourceSchema).min(1),
  downloadUrl: z.string().min(1).nullable(),
});

export const PublicPhotoPageSchema = z.object({
  eventRevision: z.number().int().nonnegative(),
  photos: z.array(PublicPhotoSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const CreateEventRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: SlugSchema.optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  startsAt: IsoDateTimeSchema,
  timezone: z.string().trim().min(1).max(100),
  visibility: EventVisibilitySchema.default('draft'),
  access: EventAccessSchema.default('public'),
  password: z.string().min(8).max(200).optional(),
  allowDownloads: z.boolean().default(false),
  faceSearchEnabled: z.boolean().default(false),
  nearbySearchEnabled: z.boolean().default(false),
  showPhotoMetadata: z.boolean().default(false),
  keepOriginals: z.boolean().default(false),
  retentionDays: z.number().int().positive().nullable().default(null),
}).superRefine((value, context) => {
  if (value.access === 'protected' && !value.password) {
    context.addIssue({ code: 'custom', message: 'password is required for protected events', path: ['password'] });
  }
  if (value.nearbySearchEnabled && !value.faceSearchEnabled) {
    context.addIssue({ code: 'custom', message: 'nearby search requires face search', path: ['nearbySearchEnabled'] });
  }
});

export const UpdateEventRequestSchema = z.object({
  coverPhotoId: IdSchema.nullable().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  startsAt: IsoDateTimeSchema.optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  visibility: EventVisibilitySchema.optional(),
  access: EventAccessSchema.optional(),
  password: z.string().min(8).max(200).optional(),
  allowDownloads: z.boolean().optional(),
  faceSearchEnabled: z.boolean().optional(),
  nearbySearchEnabled: z.boolean().optional(),
  showPhotoMetadata: z.boolean().optional(),
  keepOriginals: z.boolean().optional(),
  retentionDays: z.number().int().positive().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'at least one field is required' });

export const UnlockEventRequestSchema = z.object({
  password: z.string().min(1).max(200),
  turnstileToken: z.string().min(1).max(2_048),
});

export const UnlockEventResponseSchema = z.object({ unlocked: z.literal(true) });

export const EventListQuerySchema = z.object({});
export const PhotoListQuerySchema = z.object({
  cursor: z.string().min(1).max(2_048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export type PublicEvent = z.infer<typeof PublicEventSchema>;
export type PublicPhoto = z.infer<typeof PublicPhotoSchema>;
export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;
