import {
  PublicEventListSchema,
  PublicEventSchema,
  PublicPhotoPageSchema,
  UnlockEventResponseSchema,
} from '../../shared/schemas/gallery';
import type { PublicEvent, PublicPhoto } from '../../shared/schemas/gallery';

export class GalleryApiError extends Error {
  constructor(readonly status: number) {
    super(`Gallery API returned ${status}`);
  }
}

async function validatedFetch<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new GalleryApiError(response.status);
  const value: unknown = await response.json();
  return schema.parse(value);
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  return (await validatedFetch('/api/v1/events', PublicEventListSchema)).events;
}

export async function getPublicEvent(locator: string): Promise<PublicEvent> {
  return validatedFetch(`/api/v1/events/${encodeURIComponent(locator)}`, PublicEventSchema);
}

export async function getPublicPhotos(locator: string, cursor?: string): Promise<{
  eventRevision: number;
  photos: PublicPhoto[];
  nextCursor: string | null;
}> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return validatedFetch(`/api/v1/events/${encodeURIComponent(locator)}/photos${query}`, PublicPhotoPageSchema);
}

export async function unlockEvent(locator: string, password: string, turnstileToken: string): Promise<void> {
  await validatedFetch(`/api/v1/events/${encodeURIComponent(locator)}/unlock`, UnlockEventResponseSchema, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, turnstileToken }),
  });
}
