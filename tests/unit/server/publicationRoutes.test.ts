import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { PublicationSummary, UsageSnapshot } from '../../../src/shared/schemas';
import { mockAdmin } from '../../../src/server/auth/testContext';
import { authContext } from '../../../src/server/middleware/authContext';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { PublicationRepository } from '../../../src/server/repositories/publicationRepository';
import { registerPublicationRoutes } from '../../../src/server/routes/admin/publication';
import type { AppEnv } from '../../../src/server/types';

const summary: PublicationSummary = {
  eventId: 'event-1',
  totalPhotos: 2,
  readyPhotos: 2,
  publishedPhotos: 2,
  indexingPhotos: 1,
  publishedAt: '2030-01-01T00:00:00.000Z',
};

const usage: UsageSnapshot = {
  capturedAt: '2030-01-01T00:00:00.000Z',
  events: 1,
  photos: 2,
  storageBytes: 100,
  faces: 3,
  vectorDimensionsQueried: 128,
};

function appWith(repository: PublicationRepository) {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', authContext);
  app.use('*', mockAdmin());
  registerPublicationRoutes(app, {
    now: () => '2030-01-01T00:00:00.000Z',
    repository: () => repository,
  });
  return app;
}

describe('publication admin routes', () => {
  it('publishes without waiting for face indexing', async () => {
    const repository: PublicationRepository = {
      deletePhoto: vi.fn(),
      publishEvent: vi.fn().mockResolvedValue(summary),
      publicationSummary: vi.fn(),
      usage: vi.fn(),
    };
    const response = await appWith(repository).request('/api/v1/admin/events/event-1/publish', {
      body: JSON.stringify({ visibility: 'published' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });

  it('removes access before asynchronous provider cleanup', async () => {
    const deletePhoto = vi.fn().mockResolvedValue(true);
    const repository: PublicationRepository = {
      deletePhoto,
      publishEvent: vi.fn(),
      publicationSummary: vi.fn(),
      usage: vi.fn(),
    };
    const response = await appWith(repository).request('/api/v1/admin/photos/photo-1', {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(deletePhoto).toHaveBeenCalledWith('photo-1', '2030-01-01T00:00:00.000Z');
  });

  it('returns a validated usage snapshot', async () => {
    const repository: PublicationRepository = {
      deletePhoto: vi.fn(),
      publishEvent: vi.fn(),
      publicationSummary: vi.fn(),
      usage: vi.fn().mockResolvedValue(usage),
    };
    const response = await appWith(repository).request('/api/v1/admin/usage');
    expect(await response.json()).toEqual(usage);
  });

  it('returns publication readiness for browser-only operation', async () => {
    const repository: PublicationRepository = {
      deletePhoto: vi.fn(),
      publishEvent: vi.fn(),
      publicationSummary: vi.fn().mockResolvedValue(summary),
      usage: vi.fn(),
    };
    const response = await appWith(repository).request('/api/v1/admin/events/event-1/publication');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });
});
