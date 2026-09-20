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
  keep_originals: number;
  retention_days: number | null;
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
    keepOriginals: row.keep_originals === 1,
    retentionDays: row.retention_days,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicEvent(event: Event): PublicEvent {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    timezone: event.timezone,
    coverPhotoId: event.coverPhotoId,
    visibility: event.visibility,
    access: event.access,
    allowDownloads: event.allowDownloads,
    faceSearchEnabled: event.faceSearchEnabled,
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
}

export function photosFromRows(rows: PhotoWithVariantRow[], allowDownloads: boolean): PublicPhoto[] {
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
        downloadUrl: null,
      };
      byId.set(row.id, photo);
    }
    const url = `/media/${encodeURIComponent(row.event_id)}/${encodeURIComponent(row.id)}/${row.revision}/${row.variant}`;
    if (row.variant === 'download' || row.variant === 'original') {
      if (allowDownloads && row.variant === 'download') photo.downloadUrl = url;
    } else {
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
