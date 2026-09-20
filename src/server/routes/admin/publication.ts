import type { Context, Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import {
  IdSchema,
  PublicationSummarySchema,
  PublishEventInputSchema,
  UsageSnapshotSchema,
} from '../../../shared/schemas';
import { D1PublicationRepository } from '../../repositories/publicationRepository';
import type { PublicationRepository } from '../../repositories/publicationRepository';
import type { AppEnv } from '../../types';

export interface PublicationRouteDependencies {
  now: () => string;
  repository: (context: Context<AppEnv>) => PublicationRepository;
}

const defaultDependencies: PublicationRouteDependencies = {
  now: () => new Date().toISOString(),
  repository: (context) => new D1PublicationRepository(context.env.DB),
};

function requireAdmin(context: Context<AppEnv>): void {
  if (!context.get('auth').admin) {
    throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
  }
  context.set('cachePolicy', 'admin');
}

export function registerPublicationRoutes(
  app: Hono<AppEnv>,
  dependencies: PublicationRouteDependencies = defaultDependencies,
): void {
  app.get('/api/v1/admin/events/:eventId/publication', async (context) => {
    requireAdmin(context);
    const eventIdResult = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventIdResult.success) throw new ApiException('INVALID_EVENT_ID', 'errors.invalidEventId', 400);
    const summary = await dependencies.repository(context).publicationSummary(eventIdResult.data);
    if (!summary) throw new ApiException('EVENT_NOT_FOUND', 'errors.eventNotFound', 404);
    return context.json(PublicationSummarySchema.parse(summary));
  });

  app.post('/api/v1/admin/events/:eventId/publish', async (context) => {
    requireAdmin(context);
    const eventIdResult = IdSchema.safeParse(context.req.param('eventId'));
    if (!eventIdResult.success) throw new ApiException('INVALID_EVENT_ID', 'errors.invalidEventId', 400);
    const inputResult = PublishEventInputSchema.safeParse(await context.req.json<unknown>());
    if (!inputResult.success) throw new ApiException('INVALID_PUBLISH_REQUEST', 'errors.invalidPublishRequest', 400);
    const eventId = eventIdResult.data;
    const input = inputResult.data;
    const summary = await dependencies.repository(context).publishEvent(eventId, input, dependencies.now());
    if (!summary) {
      throw new ApiException('EVENT_NOT_READY', 'errors.eventNotReady', 409);
    }

    return context.json(PublicationSummarySchema.parse(summary));
  });

  app.delete('/api/v1/admin/photos/:photoId', async (context) => {
    requireAdmin(context);
    const photoIdResult = IdSchema.safeParse(context.req.param('photoId'));
    if (!photoIdResult.success) throw new ApiException('INVALID_PHOTO_ID', 'errors.invalidPhotoId', 400);
    const photoId = photoIdResult.data;
    const deleted = await dependencies.repository(context).deletePhoto(photoId, dependencies.now());
    if (!deleted) throw new ApiException('PHOTO_NOT_FOUND', 'errors.photoNotFound', 404);
    return context.body(null, 204);
  });

  app.get('/api/v1/admin/usage', async (context) => {
    requireAdmin(context);
    const usage = await dependencies.repository(context).usage(dependencies.now());
    return context.json(UsageSnapshotSchema.parse(usage));
  });
}
