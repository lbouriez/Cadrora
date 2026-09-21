import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema } from '../../shared/schemas';

const MAX_SESSION_PHOTOS = 2_000;

const FaceSearchPhotoReferenceSchema = z.object({
  photoId: IdSchema,
  revision: z.number().int().nonnegative(),
  thumbnailUrl: z.string().min(1),
  capturedAt: IsoDateTimeSchema.nullable(),
  momentId: z.string().max(128).nullable(),
});

const FaceSearchSessionSchema = z.object({
  matchedPhotos: z.array(FaceSearchPhotoReferenceSchema).max(MAX_SESSION_PHOTOS),
  nearbyPhotos: z.array(FaceSearchPhotoReferenceSchema).max(MAX_SESSION_PHOTOS),
  savedAt: z.string().datetime(),
});

const LegacyFaceSearchSessionSchema = z.object({
  photoIds: z.array(IdSchema).max(MAX_SESSION_PHOTOS),
  savedAt: z.string().datetime(),
});

export type FaceSearchPhotoReference = z.infer<typeof FaceSearchPhotoReferenceSchema>;

export interface FaceSearchSessionResults {
  matchedPhotoIds: string[];
  matchedPhotos: FaceSearchPhotoReference[];
  nearbyPhotoIds: string[];
  nearbyPhotos: FaceSearchPhotoReference[];
}

const emptyResults = (): FaceSearchSessionResults => ({
  matchedPhotoIds: [],
  matchedPhotos: [],
  nearbyPhotoIds: [],
  nearbyPhotos: [],
});

const key = (eventSlug: string) => `cadrora:face-search:${eventSlug}`;

function uniqueReferences(references: FaceSearchPhotoReference[], excluded = new Set<string>()): FaceSearchPhotoReference[] {
  const unique = new Map<string, FaceSearchPhotoReference>();
  for (const reference of references) {
    if (!excluded.has(reference.photoId)) {
      const sanitized = FaceSearchPhotoReferenceSchema.parse(reference);
      unique.set(sanitized.photoId, sanitized);
    }
  }
  return [...unique.values()];
}

/** Persists only event photo references for this browser session; never selfie data, embeddings, or scores. */
export function saveFaceSearchResults(
  eventSlug: string,
  matchedPhotos: FaceSearchPhotoReference[],
  nearbyPhotos: FaceSearchPhotoReference[] = [],
): void {
  try {
    const uniqueMatches = uniqueReferences(matchedPhotos).slice(0, MAX_SESSION_PHOTOS);
    const matchIds = new Set(uniqueMatches.map((photo) => photo.photoId));
    const uniqueNearby = uniqueReferences(nearbyPhotos, matchIds).slice(0, MAX_SESSION_PHOTOS - uniqueMatches.length);
    sessionStorage.setItem(key(eventSlug), JSON.stringify({
      matchedPhotos: uniqueMatches,
      nearbyPhotos: uniqueNearby,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Storage can be disabled. The current search remains fully usable in memory.
  }
}

export function readFaceSearchResults(eventSlug: string): FaceSearchSessionResults {
  try {
    const raw = sessionStorage.getItem(key(eventSlug));
    if (!raw) return emptyResults();
    const value: unknown = JSON.parse(raw);
    const result = FaceSearchSessionSchema.safeParse(value);
    if (result.success) {
      return {
        matchedPhotoIds: result.data.matchedPhotos.map((photo) => photo.photoId),
        matchedPhotos: result.data.matchedPhotos,
        nearbyPhotoIds: result.data.nearbyPhotos.map((photo) => photo.photoId),
        nearbyPhotos: result.data.nearbyPhotos,
      };
    }
    const legacy = LegacyFaceSearchSessionSchema.safeParse(value);
    return legacy.success
      ? { ...emptyResults(), matchedPhotoIds: legacy.data.photoIds }
      : emptyResults();
  } catch {
    return emptyResults();
  }
}
