import { AdminEventListSchema } from '../../shared/schemas';
import { AdminCoverPhotosSchema, AdminFavoritePhotosSchema, AdminOriginalsStatusSchema, ReplacePhotoResponseSchema } from '../../shared/schemas/gallery';
import type { Event } from '../../shared/schemas';

export async function getAdminEvents(): Promise<Event[]> {
  const response = await fetch('/api/v1/admin/galleries', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Event list returned ${response.status}`);
  return AdminEventListSchema.parse(await response.json()).events;
}

export async function getCoverPhotos(eventId: string, offset: number) {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/cover-photos?offset=${offset}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Cover photos returned ${response.status}`);
  return AdminCoverPhotosSchema.parse(await response.json());
}

export async function getFavoritePhotos(eventId: string, offset: number, view: 'retouch' | 'favorites') {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/selections?offset=${offset}&view=${view}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Favorite photos returned ${response.status}`);
  return AdminFavoritePhotosSchema.parse(await response.json());
}

export async function replaceFavoritePhoto(eventId: string, photoId: string, importId: string) {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/replace`, {
    body: JSON.stringify({ importId }), credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, method: 'POST',
  });
  if (!response.ok) throw new Error(`Photo replacement returned ${response.status}`);
  return ReplacePhotoResponseSchema.parse(await response.json());
}

export async function getOriginalsStatus(eventId: string) {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/originals`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Original status returned ${response.status}`);
  return AdminOriginalsStatusSchema.parse(await response.json());
}

export async function requestOriginalsCleanup(eventId: string) {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/originals/cleanup`, {
    credentials: 'same-origin', method: 'POST',
  });
  if (!response.ok) throw new Error(`Original cleanup returned ${response.status}`);
  return AdminOriginalsStatusSchema.parse(await response.json());
}

export async function abandonOriginalImports(eventId: string) {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}/originals/abandon-imports`, {
    credentials: 'same-origin', method: 'POST',
  });
  if (!response.ok) throw new Error(`Abandoning original imports returned ${response.status}`);
  return AdminOriginalsStatusSchema.parse(await response.json());
}
