import type { Context } from 'hono';
import type { Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import { MediaParamsSchema } from '../../shared/schemas';
import { D1MediaRepository } from '../repositories/mediaRepository';
import type { MediaRepository } from '../repositories/mediaRepository';
import { R2StorageService } from '../services/storage';
import type { StorageService } from '../services/storage';
import type { AppEnv } from '../types';

export interface MediaRouteDependencies {
  repository: (context: Context<AppEnv>) => MediaRepository;
  storage: (context: Context<AppEnv>) => StorageService;
}

const defaultDependencies: MediaRouteDependencies = {
  repository: (context) => new D1MediaRepository(context.env.DB),
  storage: (context) => new R2StorageService(context.env.MEDIA_BUCKET),
};

function downloadName(filename: string, contentType: string): string {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : null;
  if (!extension) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
  const basename = filename.replace(/\.[^.]+$/u, '').replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 100) || 'photo';
  return `${basename}.${extension}`;
}

export function registerMediaRoutes(
  app: Hono<AppEnv>,
  dependencies: MediaRouteDependencies = defaultDependencies,
): void {
  app.get('/media/:eventId/:photoId/:revision/:variant', async (context) => {
    const parsed = MediaParamsSchema.safeParse(context.req.param());
    if (!parsed.success) throw new ApiException('INVALID_MEDIA_PATH', 'errors.invalidMediaPath', 400);

    const media = await dependencies.repository(context).findPublishedVariant(parsed.data);
    if (!media) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);

    if (media.access === 'protected') {
      const grant = context.get('auth').eventGrant;
      if (
        !grant ||
        grant.eventId !== parsed.data.eventId ||
        media.accessVersion === null ||
        grant.accessVersion !== media.accessVersion
      ) {
        throw new ApiException('EVENT_ACCESS_REQUIRED', 'errors.eventAccessRequired', 403);
      }
      context.set('cachePolicy', 'media-protected');
    } else {
      context.set('cachePolicy', 'media-public');
    }

    const isDownload = parsed.data.variant === 'download' || parsed.data.variant === 'original';
    if (isDownload && !media.allowDownloads) {
      throw new ApiException('DOWNLOAD_NOT_ALLOWED', 'errors.downloadNotAllowed', 403);
    }
    if (parsed.data.variant === 'original' && !media.keepOriginals) {
      throw new ApiException('DOWNLOAD_NOT_ALLOWED', 'errors.downloadNotAllowed', 403);
    }
    if (isDownload) context.set('cachePolicy', 'media-download');

    const object = await dependencies.storage(context).get(media.storageKey);
    if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);

    const headers = new Headers({
      'Content-Length': String(object.contentLength),
      'Content-Type': media.contentType,
      ETag: object.etag,
      'X-Content-Type-Options': 'nosniff',
    });
    if (isDownload) {
      headers.set('Content-Disposition', `attachment; filename="${downloadName(media.filename, media.contentType)}"`);
    }

    return new Response(object.body, { headers });
  });
}
