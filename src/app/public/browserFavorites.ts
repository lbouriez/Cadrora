import { z } from '../../shared/zod';

import { IdSchema } from '../../shared/schemas/primitives';

const FavoriteIdsSchema = z.array(IdSchema).max(10_000);

export function browserFavoritesKey(galleryId: string): string {
  return `cadrora:public-favorites:${galleryId}`;
}

/** Public hearts stay in this browser; storage failures still allow in-page toggling. */
export function readBrowserFavorites(galleryId: string): Set<string> {
  try {
    const value = localStorage.getItem(browserFavoritesKey(galleryId));
    if (!value) return new Set();
    const parsed = FavoriteIdsSchema.safeParse(JSON.parse(value));
    return new Set(parsed.success ? parsed.data : []);
  } catch {
    return new Set();
  }
}

export function writeBrowserFavorites(galleryId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(browserFavoritesKey(galleryId), JSON.stringify([...ids]));
  } catch {
    // The current page can still use its in-memory state when storage is unavailable.
  }
}
