import { FaceSearchResponseSchema, RelatedPhotosResponseSchema } from '../../shared/schemas';
import type { FaceSearchMatch } from '../../shared/schemas';

async function jsonRequest<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`FACE_SEARCH_${response.status}`);
  return schema.parse(await response.json() as unknown);
}

export async function searchEventFaces(eventId: string, embedding: number[], cursor?: string): Promise<{
  matches: FaceSearchMatch[];
  nextCursor: string | null;
}> {
  return jsonRequest(`/api/v1/galleries/${encodeURIComponent(eventId)}/face-search`, FaceSearchResponseSchema, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embedding, ...(cursor ? { cursor } : {}) }),
  });
}

export async function getRelatedPhotos(eventId: string, photoId: string) {
  return jsonRequest(
    `/api/v1/galleries/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/related`,
    RelatedPhotosResponseSchema,
  );
}
