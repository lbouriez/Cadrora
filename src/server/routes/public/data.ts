import type { Event, PhotoVariant } from '../../../shared/schemas';
import type { PublicEvent, PublicPhoto } from '../../../shared/schemas/gallery';

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  timezone: string;
  cover_photo_id: string | null;
  visibility: Event['visibility'];
  access: Event['access'];
  allow_downloads: number;
  face_search_enabled: number;
  nearby_search_enabled: number;
  show_photo_metadata: number;
  keep_originals: number;
  retention_days: number | null;
  offline_at: string | null;
  deleting_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export function eventFromRow(row: EventRow): Event {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    timezone: row.timezone,
    coverPhotoId: row.cover_photo_id,
    visibility: row.visibility,
    access: row.access,
    allowDownloads: row.allow_downloads === 1,
    faceSearchEnabled: row.face_search_enabled === 1,
    nearbySearchEnabled: row.nearby_search_enabled === 1,
    showPhotoMetadata: row.show_photo_metadata === 1,
    keepOriginals: row.keep_originals === 1,
    retentionDays: row.retention_days,
    offlineAt: row.offline_at,
    deletingAt: row.deleting_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isEventAvailable(event: Event): boolean {
  return event.visibility !== 'draft' && event.offlineAt === null;
}

export function toPublicEvent(event: Event, coverRevision: number | null = null): PublicEvent {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    timezone: event.timezone,
    coverPhotoId: event.coverPhotoId,
    coverPhotoUrl: event.coverPhotoId && coverRevision !== null
      ? `/media/${encodeURIComponent(event.id)}/${encodeURIComponent(event.coverPhotoId)}/${coverRevision}/medium`
      : null,
    visibility: event.visibility,
    access: event.access,
    allowDownloads: event.allowDownloads,
    faceSearchEnabled: event.faceSearchEnabled,
    nearbySearchEnabled: event.nearbySearchEnabled,
    showPhotoMetadata: event.showPhotoMetadata,
    retentionDays: event.retentionDays,
    revision: event.revision,
    updatedAt: event.updatedAt,
  };
}

export async function findEvent(database: D1Database, locator: string): Promise<Event | null> {
  const row = await database
    .prepare('SELECT * FROM events WHERE id = ?1 OR slug = ?1 LIMIT 1')
    .bind(locator)
    .first<EventRow>();
  return row ? eventFromRow(row) : null;
}

export interface PhotoWithVariantRow {
  id: string;
  event_id: string;
  filename: string;
  width: number;
  height: number;
  captured_at: string | null;
  sort_key: string;
  revision: number;
  variant: PhotoVariant['variant'];
  content_type: PhotoVariant['contentType'];
  variant_width: number;
  variant_height: number;
  liked: number;
}

export function photosFromRows(rows: PhotoWithVariantRow[], allowDownloads: boolean, keepOriginals = false, showFavorites = false): PublicPhoto[] {
  const byId = new Map<string, PublicPhoto>();
  for (const row of rows) {
    let photo = byId.get(row.id);
    if (!photo) {
      photo = {
        id: row.id,
        eventId: row.event_id,
        filename: row.filename,
        width: row.width,
        height: row.height,
        capturedAt: row.captured_at,
        sortKey: row.sort_key,
        revision: row.revision,
        sources: [],
        downloadUrl: allowDownloads
          ? `/media/${encodeURIComponent(row.event_id)}/${encodeURIComponent(row.id)}/${row.revision}/download`
          : null,
        liked: showFavorites && row.liked === 1,
      };
      byId.set(row.id, photo);
    }
    const url = `/media/${encodeURIComponent(row.event_id)}/${encodeURIComponent(row.id)}/${row.revision}/${row.variant}`;
    if (row.variant === 'download' || row.variant === 'original') {
      if (allowDownloads && keepOriginals && row.variant === 'original') photo.downloadUrl = url;
    } else {
      if (row.content_type === 'image/png') continue;
      photo.sources.push({
        url,
        width: row.variant_width,
        height: row.variant_height,
        contentType: row.content_type,
      });
    }
  }
  return [...byId.values()].filter((photo) => photo.sources.length > 0);
}
