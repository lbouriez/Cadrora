import { WorkerEntrypoint } from 'cloudflare:workers';

import { IdSchema } from '../../shared/schemas';

export const PUBLIC_MEDIA_EDGE_TTL_SECONDS = 300;

export interface PublicMediaCacheProps {
  contentType: string;
  eventId: string;
  storageKey: string;
}

function galleryTag(eventId: string): string {
  return `gallery-media:${eventId}`;
}

/** Called only after the default entrypoint has checked the current D1 media row. */
export class PublicMediaCache extends WorkerEntrypoint<CloudflareBindings, PublicMediaCacheProps> {
  async fetch(request: Request): Promise<Response> {
    const { contentType, eventId, storageKey } = this.ctx.props;
    if (!IdSchema.safeParse(eventId).success ||
      !storageKey.startsWith(`events/${eventId}/photos/`) ||
      !/^events\/[^/]+\/photos\/[^/]+\/\d+\/(thumb|small|medium|large)\.(jpg|webp|png)$/u.test(storageKey) ||
      !new URL(request.url).pathname.startsWith(`/media/${eventId}/`)) {
      return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const object = await this.env.MEDIA_BUCKET.get(storageKey);
    if (!object) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(object.body, {
      headers: {
        'Cache-Control': `public, max-age=${PUBLIC_MEDIA_EDGE_TTL_SECONDS}, must-revalidate, stale-if-error=0`,
        'Cache-Tag': galleryTag(eventId),
        'Content-Length': String(object.size),
        'Content-Type': contentType,
        ETag: object.httpEtag,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  async purgeGallery(eventId: string): Promise<void> {
    const parsed = IdSchema.safeParse(eventId);
    if (!parsed.success || !this.ctx.cache) throw new Error('PUBLIC_MEDIA_CACHE_PURGE_UNAVAILABLE');
    const result = await this.ctx.cache.purge({ tags: [galleryTag(parsed.data)] });
    if (!result.success) {
      const code = result.errors.map((error) => error.code).join(',') || 'unknown';
      throw new Error(`PUBLIC_MEDIA_CACHE_PURGE_FAILED:${code}`);
    }
  }
}

interface PublicMediaCacheExport {
  fetch(request: Request, options: { props: PublicMediaCacheProps }): Promise<Response>;
  purgeGallery(eventId: string): Promise<void>;
}

function cacheExport(executionContext: unknown): PublicMediaCacheExport | null {
  if (!executionContext || typeof executionContext !== 'object' || !('exports' in executionContext)) return null;
  const exports = executionContext.exports as { PublicMediaCache?: PublicMediaCacheExport } | undefined;
  return exports?.PublicMediaCache ?? null;
}

export async function readPublicMediaCache(
  executionContext: unknown,
  requestUrl: string,
  props: PublicMediaCacheProps,
): Promise<Response | null> {
  const binding = cacheExport(executionContext);
  if (!binding) throw new Error('PUBLIC_MEDIA_CACHE_UNAVAILABLE');
  const url = new URL(requestUrl);
  url.search = '';
  return binding.fetch(new Request(url), { props });
}

export async function purgePublicMediaCache(executionContext: unknown, eventId: string): Promise<void> {
  const binding = cacheExport(executionContext);
  if (!binding) throw new Error('PUBLIC_MEDIA_CACHE_PURGE_UNAVAILABLE');
  await binding.purgeGallery(eventId);
}
