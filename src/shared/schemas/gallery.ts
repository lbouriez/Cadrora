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
  createdAt: true,
  retentionDays: true,
  revision: true,
  updatedAt: true,
}).extend({ coverPhotoUrl: z.string().startsWith('/media/').nullable() });

export const AdminCoverPhotoQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
}).strict();

export const AdminCoverPhotosSchema = z.object({
  photos: z.array(z.object({
    id: IdSchema,
    filename: z.string().min(1).max(512),
    thumbnailUrl: z.string().startsWith('/api/v1/admin/galleries/'),
  })),
  nextOffset: z.number().int().nonnegative().nullable(),
});

export const AdminFavoritePhotosQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  view: z.enum(['retouch', 'favorites']).default('retouch'),
}).strict();

export const AdminFavoritePhotoSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  filename: z.string().min(1).max(512),
  revision: z.number().int().nonnegative(),
  thumbnailUrl: z.string().startsWith('/api/v1/admin/galleries/'),
  downloadUrl: z.string().startsWith('/api/v1/admin/galleries/'),
  pendingImportId: IdSchema.nullable(),
  replaceable: z.boolean(),
});

export const AdminFavoritePhotosSchema = z.object({
  photos: z.array(AdminFavoritePhotoSchema),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
}).strict();

export const ReplacePhotoRequestSchema = z.object({ importId: IdSchema }).strict();
export const ReplacePhotoResponseSchema = z.object({ photoId: IdSchema, revision: z.number().int().nonnegative() }).strict();

export const ProtectedGalleryPreviewSchema = z.object({
    id: IdSchema,
    slug: SlugSchema,
    title: EventSchema.shape.title,
    description: EventSchema.shape.description,
    startsAt: IsoDateTimeSchema,
    createdAt: IsoDateTimeSchema,
}).strict();

export const PublicEventListSchema = z.object({
  events: z.array(PublicEventSchema),
  protectedGalleries: z.array(ProtectedGalleryPreviewSchema),
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
  liked: z.boolean(),
  selectedForRetouch: z.boolean(),
});

export const PhotoFavoriteRequestSchema = z.object({ liked: z.boolean() }).strict();
export const PhotoFavoriteResponseSchema = z.object({ liked: z.boolean() }).strict();
export const PhotoFavoriteParamsSchema = z.object({ eventId: IdSchema, photoId: IdSchema }).strict();
export const PhotoRetouchRequestSchema = z.object({ selected: z.boolean() }).strict();
export const PhotoRetouchResponseSchema = z.object({ selected: z.boolean() }).strict();

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
  showOnGalleryPage: z.boolean().default(true),
  keepOriginals: z.boolean().default(false),
  retentionDays: z.number().int().positive().nullable().default(null),
}).superRefine((value, context) => {
  if (value.access === 'protected' && !value.password) {
    context.addIssue({ code: 'custom', message: 'password is required for protected events', path: ['password'] });
  }
  if (value.nearbySearchEnabled && !value.faceSearchEnabled) {
    context.addIssue({ code: 'custom', message: 'nearby search requires face search', path: ['nearbySearchEnabled'] });
  }
  if (value.keepOriginals && !value.allowDownloads) {
    context.addIssue({ code: 'custom', message: 'original delivery requires downloads', path: ['keepOriginals'] });
  }
});

export const UpdateEventRequestSchema = z.object({
  coverPhotoId: IdSchema.nullable().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  startsAt: IsoDateTimeSchema.optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  access: EventAccessSchema.optional(),
  password: z.string().min(8).max(200).optional(),
  allowDownloads: z.boolean().optional(),
  faceSearchEnabled: z.boolean().optional(),
  nearbySearchEnabled: z.boolean().optional(),
  showPhotoMetadata: z.boolean().optional(),
  showOnGalleryPage: z.boolean().optional(),
  keepOriginals: z.boolean().optional(),
  retentionDays: z.number().int().positive().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'at least one field is required' });

export const DeleteGalleryRequestSchema = z.object({
  confirmation: z.string().min(1).max(160),
}).strict();

export const DeleteGalleryResponseSchema = z.object({
  deletionQueued: z.literal(true),
});

export const AdminOriginalsStatusSchema = z.object({
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  activeImports: z.number().int().nonnegative(),
  cleanupState: z.enum(['idle', 'pending', 'running', 'failed']),
});

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
export type ProtectedGalleryPreview = z.infer<typeof ProtectedGalleryPreviewSchema>;
export type PublicPhoto = z.infer<typeof PublicPhotoSchema>;
export type AdminFavoritePhoto = z.infer<typeof AdminFavoritePhotoSchema>;
export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;
