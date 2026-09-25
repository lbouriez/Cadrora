import { z } from 'zod';

import { PHOTO_VARIANT_WIDTHS } from '../constants';
import { IdSchema, IsoDateTimeSchema } from './primitives';
import { PhotoSchema, PhotoVariantSchema } from './photo';
import type { PhotoVariantNameSchema } from './photo';

export const ImportStateSchema = z.enum([
  'pending',
  'processing',
  'paused',
  'completed',
  'cancelled',
  'failed',
]);

export const ImportChunkStateSchema = z.enum(['pending', 'uploading', 'finalized', 'failed']);

export const ImportSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  state: ImportStateSchema,
  totalPhotos: z.number().int().nonnegative(),
  completedPhotos: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ImportChunkSchema = z.object({
  importId: IdSchema,
  number: z.number().int().nonnegative(),
  photoIds: z.array(IdSchema).max(50),
  state: ImportChunkStateSchema,
  updatedAt: IsoDateTimeSchema,
});

/** Browser declaration for an idempotent import. The id is generated client-side. */
export const ImportCreateRequestSchema = z
  .object({
    id: IdSchema,
    totalPhotos: z.number().int().nonnegative().max(100_000),
    keepOriginals: z.boolean().default(false),
    replacementPhotoId: IdSchema.optional(),
  })
  .strict();

export const ImportCreateResponseSchema = z
  .object({
    import: ImportSchema,
  })
  .strict();

/** A photo is declared before any media bytes are accepted by the Worker. */
export const PhotoDeclarationSchema = z
  .object({
    capturedAt: IsoDateTimeSchema.nullable().optional(),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    filename: z.string().min(1).max(512),
    height: z.number().int().positive().max(100_000),
    id: IdSchema,
    sortKey: z.string().min(1).max(256),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    width: z.number().int().positive().max(100_000),
  })
  .strict();

export const PhotoDuplicateCheckRequestSchema = z.object({
  hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(50),
}).strict();

export const PhotoDuplicateCheckResponseSchema = z.object({
  existingHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(50),
}).strict();

/** A server transaction accepts no more than one durable browser work chunk. */
export const ImportDeclarePhotosRequestSchema = z
  .object({
    chunkNumber: z.number().int().nonnegative(),
    photos: z.array(PhotoDeclarationSchema).min(1).max(50),
  })
  .strict()
  .superRefine(({ photos }, context) => {
    const ids = new Set<string>();
    for (const [index, photo] of photos.entries()) {
      if (ids.has(photo.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate photo id in import chunk.',
          path: ['photos', index, 'id'],
        });
      }
      ids.add(photo.id);
    }
  });

export const ImportDeclarePhotosResponseSchema = z
  .object({
    import: ImportSchema,
    photoIds: z.array(IdSchema).min(1).max(50),
  })
  .strict();

/** Binary variant metadata is carried in request headers, not an unvalidated JSON side channel. */
export const VariantUploadHeadersSchema = z
  .object({
    byteSize: z.coerce.number().int().positive().max(100 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    height: z.coerce.number().int().positive().max(100_000),
    width: z.coerce.number().int().positive().max(100_000),
  })
  .strict();

export const VariantUploadResponseSchema = z
  .object({
    variant: PhotoVariantSchema,
  })
  .strict();

export const FinalizePhotoRequestSchema = z.object({}).strict();

export const FinalizePhotoResponseSchema = z
  .object({
    import: ImportSchema,
    photo: PhotoSchema,
  })
  .strict();

export const RequiredPhotoVariantNames = Object.keys(PHOTO_VARIANT_WIDTHS) as [
  z.infer<typeof PhotoVariantNameSchema>,
  ...z.infer<typeof PhotoVariantNameSchema>[],
];

export type Import = z.infer<typeof ImportSchema>;
export type ImportChunk = z.infer<typeof ImportChunkSchema>;
export type ImportCreateRequest = z.infer<typeof ImportCreateRequestSchema>;
export type ImportDeclarePhotosRequest = z.infer<typeof ImportDeclarePhotosRequestSchema>;
export type PhotoDeclaration = z.infer<typeof PhotoDeclarationSchema>;
export type VariantUploadHeaders = z.infer<typeof VariantUploadHeadersSchema>;
