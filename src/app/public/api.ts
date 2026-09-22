import { ApiErrorSchema } from '../../shared/schemas/apiError';
import { SiteSettingsSchema } from '../../shared/schemas/site';
import {
  PublicEventListSchema,
  PublicEventSchema,
  PublicPhotoPageSchema,
  UnlockEventResponseSchema,
} from '../../shared/schemas/gallery';
import type { PublicEvent, PublicPhoto } from '../../shared/schemas/gallery';
import type { SiteSettings } from '../../shared/schemas/site';

export class GalleryApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(`Gallery API returned ${status}`);
  }
}

async function validatedFetch<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(await response.clone().json().catch(() => null));
    throw new GalleryApiError(response.status, error.success ? error.data.code : undefined);
  }
  const value: unknown = await response.json();
  return schema.parse(value);
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  return (await validatedFetch('/api/v1/galleries', PublicEventListSchema)).events;
}

/** Optional runtime presentation setting; public pages retain a safe local fallback if it is unavailable. */
export async function getPublicSiteSettings(): Promise<SiteSettings> {
  return validatedFetch('/api/v1/site', SiteSettingsSchema);
}

export async function getPublicEvent(locator: string): Promise<PublicEvent> {
  return validatedFetch(`/api/v1/galleries/${encodeURIComponent(locator)}`, PublicEventSchema);
}

export async function getPublicPhotos(locator: string, cursor?: string): Promise<{
  eventRevision: number;
  photos: PublicPhoto[];
  nextCursor: string | null;
}> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return validatedFetch(`/api/v1/galleries/${encodeURIComponent(locator)}/photos${query}`, PublicPhotoPageSchema);
}

export async function unlockEvent(locator: string, password: string, turnstileToken: string): Promise<void> {
  await validatedFetch(`/api/v1/galleries/${encodeURIComponent(locator)}/unlock`, UnlockEventResponseSchema, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, turnstileToken }),
  });
}
