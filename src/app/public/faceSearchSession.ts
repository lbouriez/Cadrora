import { z } from 'zod';

import { IdSchema } from '../../shared/schemas';

const FaceSearchSessionSchema = z.object({
  photoIds: z.array(IdSchema).max(2_000),
  savedAt: z.string().datetime(),
});

const key = (eventSlug: string) => `cadrora:face-search:${eventSlug}`;

/** Persists only matched photo IDs for the current browser session; never selfie data or embeddings. */
export function saveFaceSearchResults(eventSlug: string, photoIds: string[]): void {
  try {
    const uniqueIds = [...new Set(photoIds)].slice(0, 2_000);
    sessionStorage.setItem(key(eventSlug), JSON.stringify({ photoIds: uniqueIds, savedAt: new Date().toISOString() }));
  } catch {
    // Storage can be disabled. The current search remains fully usable in memory.
  }
}

export function readFaceSearchResults(eventSlug: string): string[] {
  try {
    const raw = sessionStorage.getItem(key(eventSlug));
    if (!raw) return [];
    const result = FaceSearchSessionSchema.safeParse(JSON.parse(raw) as unknown);
    return result.success ? result.data.photoIds : [];
  } catch {
    return [];
  }
}
