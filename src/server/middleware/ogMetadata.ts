import { createMiddleware } from 'hono/factory';

import { findEvent, isEventAvailable } from '../routes/public/data';
import type { AppEnv } from '../types';
import { applyCachePolicy } from './cacheHeaders';

const EVENT_PATH = /^\/e\/([^/]+)(?:\/photo\/[^/]+)?\/?$/u;
const CRAWLER_USER_AGENT = /bot|crawler|facebookexternalhit|linkedinbot|slackbot|twitterbot|whatsapp|discordbot/iu;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const ogMetadata = createMiddleware<AppEnv>(async (context, next) => {
  const match = EVENT_PATH.exec(context.req.path);
  const userAgent = context.req.header('User-Agent') ?? '';
  if (!match || !CRAWLER_USER_AGENT.test(userAgent)) {
    await next();
    return;
  }

  const event = await findEvent(context.env.DB, decodeURIComponent(match[1] ?? ''));
  if (!event || !isEventAvailable(event)) {
    applyCachePolicy(context, 'event-protected');
    context.header('X-Robots-Tag', 'noindex, nofollow');
    context.res = context.html('<!doctype html><html lang="fr"><head><meta name="robots" content="noindex,nofollow"><title>Cadrora</title></head><body></body></html>', 404);
    return;
  }

  const mayIndex = event.visibility === 'published' && event.access === 'public';
  const title = mayIndex ? event.title : 'Cadrora';
  const description = mayIndex ? (event.description ?? '') : '';
  const robots = mayIndex ? 'index,follow' : 'noindex,nofollow';
  const canonical = new URL(`/e/${encodeURIComponent(event.slug)}`, context.req.url).toString();
  const cover = mayIndex && event.coverPhotoId
    ? await context.env.DB.prepare(
        "SELECT revision FROM photos WHERE id = ?1 AND event_id = ?2 AND state = 'published' LIMIT 1",
      ).bind(event.coverPhotoId, event.id).first<{ revision: number }>()
    : null;
  const image = cover && event.coverPhotoId
    ? new URL(
        `/media/${encodeURIComponent(event.id)}/${encodeURIComponent(event.coverPhotoId)}/${cover.revision}/large`,
        context.req.url,
      ).toString()
    : null;
  applyCachePolicy(context, event.access === 'public' ? 'event-public' : 'event-protected');
  if (!mayIndex) context.header('X-Robots-Tag', 'noindex, nofollow');
  context.res = context.html(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}"><link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
</head><body><main><h1>${escapeHtml(title)}</h1></main></body></html>`);
});
