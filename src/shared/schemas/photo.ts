import { z } from 'zod';

import { PHOTO_VARIANT_WIDTHS } from '../constants';
import { IdSchema, IsoDateTimeSchema } from './primitives';

export const PhotoStateSchema = z.enum([
  'pending',
  'variants_ready',
  'published',
  'deleting',
  'deleted',
]);

export const FaceStateSchema = z.enum([
  'disabled',
  'pending',
  'indexing',
  'ready',
  'expired',
  'deleting',
  'failed',
]);

export const PhotoVariantNameSchema = z.enum(
  Object.keys(PHOTO_VARIANT_WIDTHS) as [
    keyof typeof PHOTO_VARIANT_WIDTHS,
    ...(keyof typeof PHOTO_VARIANT_WIDTHS)[],
  ],
);

export const PhotoSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  importId: IdSchema,
  filename: z.string().min(1).max(512),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  capturedAt: IsoDateTimeSchema.nullable(),
  momentId: z.string().max(128).nullable(),
  sortKey: z.string().min(1).max(256),
  revision: z.number().int().nonnegative(),
  state: PhotoStateSchema,
  faceState: FaceStateSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const PhotoVariantSchema = z.object({
  photoId: IdSchema,
  variant: PhotoVariantNameSchema.or(z.literal('original')),
  storageKey: z.string().min(1).max(1_024),
  contentType: z.enum(['image/jpeg', 'image/webp']),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: IsoDateTimeSchema,
});

export type Photo = z.infer<typeof PhotoSchema>;
export type PhotoVariant = z.infer<typeof PhotoVariantSchema>;

