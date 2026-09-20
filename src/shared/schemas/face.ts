import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema } from './primitives';

export const FaceRefSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  photoId: IdSchema,
  partitionId: IdSchema,
  vectorId: z.string().min(1).max(256),
  modelId: z.string().min(1).max(128),
  expiresAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

export const FaceEmbeddingSchema = z.array(z.number().finite()).length(128);

export const AdminFaceInputSchema = z.object({
  modelId: z.string().min(1).max(128),
  generation: z.number().int().nonnegative(),
  expiresAt: IsoDateTimeSchema,
  faces: z.array(z.object({
    faceNumber: z.number().int().nonnegative(),
    embedding: FaceEmbeddingSchema,
  })).min(1).max(100),
}).superRefine((value, context) => {
  const faceNumbers = new Set<number>();
  for (const [index, face] of value.faces.entries()) {
    if (faceNumbers.has(face.faceNumber)) {
      context.addIssue({ code: 'custom', message: 'faceNumber must be unique', path: ['faces', index, 'faceNumber'] });
    }
    faceNumbers.add(face.faceNumber);
  }
});

export const AdminFaceResultSchema = z.object({
  indexed: z.number().int().nonnegative(),
  photoId: IdSchema,
});

export const FaceSearchRequestSchema = z.object({
  embedding: FaceEmbeddingSchema,
  cursor: z.string().min(1).max(2_048).optional(),
});

export const FaceSearchMatchSchema = z.object({
  photoId: IdSchema,
  score: z.number().finite().min(0).max(1),
  revision: z.number().int().nonnegative(),
  thumbnailUrl: z.string().min(1),
  capturedAt: IsoDateTimeSchema.nullable(),
  momentId: z.string().max(128).nullable(),
});

export const FaceSearchResponseSchema = z.object({
  matches: z.array(FaceSearchMatchSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const RelatedPhotosResponseSchema = z.object({
  photos: z.array(z.object({
    photoId: IdSchema,
    revision: z.number().int().nonnegative(),
    thumbnailUrl: z.string().min(1),
    capturedAt: IsoDateTimeSchema.nullable(),
    momentId: z.string().max(128).nullable(),
  })),
});

export const PurgeFacesResponseSchema = z.object({ queued: z.literal(true) });

export type FaceRef = z.infer<typeof FaceRefSchema>;
export type FaceSearchMatch = z.infer<typeof FaceSearchMatchSchema>;
