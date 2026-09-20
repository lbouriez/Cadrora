import { z } from 'zod';

import { EventVisibilitySchema } from './event';
import { IdSchema, IsoDateTimeSchema } from './primitives';

export const MediaParamsSchema = z.object({
  eventId: IdSchema,
  photoId: IdSchema,
  revision: z.coerce.number().int().nonnegative(),
  variant: z.enum(['thumb', 'small', 'medium', 'large', 'download', 'original']),
});

export const PublishEventInputSchema = z.object({
  visibility: EventVisibilitySchema.extract(['published', 'unlisted']),
});

export const PublicationSummarySchema = z.object({
  eventId: IdSchema,
  totalPhotos: z.number().int().nonnegative(),
  readyPhotos: z.number().int().nonnegative(),
  publishedPhotos: z.number().int().nonnegative(),
  indexingPhotos: z.number().int().nonnegative(),
  publishedAt: IsoDateTimeSchema.nullable(),
});

export type MediaParams = z.infer<typeof MediaParamsSchema>;
export type PublicationSummary = z.infer<typeof PublicationSummarySchema>;
export type PublishEventInput = z.infer<typeof PublishEventInputSchema>;

