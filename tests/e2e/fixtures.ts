import { expect, test as base } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

export const NOW = '2026-09-20T16:00:00.000Z';

export const publicEvent = {
  access: 'public',
  allowDownloads: true,
  coverPhotoId: 'photo-1',
  coverPhotoUrl: null,
  description: 'Une journee lumineuse au bord du fleuve.',
  faceSearchEnabled: true,
  nearbySearchEnabled: true,
  showPhotoMetadata: true,
  retouchSelectionEnabled: true,
  showOnGalleryPage: true,
  id: 'event-1',
  retentionDays: 30,
  revision: 3,
  slug: 'mariage-lumiere',
  startsAt: NOW,
  createdAt: NOW,
  timezone: 'America/Toronto',
  title: 'Mariage Lumiere',
  updatedAt: NOW,
  visibility: 'published',
  offlineAt: null,
} as const;

export const protectedEvent = {
  ...publicEvent,
  access: 'protected',
  id: 'event-2',
  slug: 'soiree-privee',
  title: 'Soiree privee',
} as const;

export const publicPhoto = {
  capturedAt: NOW,
  downloadUrl: '/media/event-1/photo-1/2/download',
  eventId: publicEvent.id,
  filename: 'danse-au-coucher-du-soleil.jpg',
  height: 1_200,
  id: 'photo-1',
  liked: false,
  selectedForRetouch: false,
  revision: 2,
  sortKey: '00000001',
  sources: [
    {
      contentType: 'image/jpeg',
      height: 480,
      url: '/e2e/photo-1.svg',
      width: 720,
    },
  ],
  width: 1_800,
} as const;

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

export async function installTurnstileStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface E2ETurnstile {
      execute: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      render: (container: HTMLElement, options: { callback: (token: string) => void }) => string;
      reset: (widgetId: string) => void;
    }
    let nextId = 0;
    const callbacks = new Map<string, (token: string) => void>();
    const e2eWindow = window as Window & { turnstile?: E2ETurnstile };
    e2eWindow.turnstile = {
      execute(widgetId: string) {
        callbacks.get(widgetId)?.('e2e-turnstile-token');
      },
      remove(widgetId: string) {
        callbacks.delete(widgetId);
      },
      render(_container: HTMLElement, options: { callback: (token: string) => void }) {
        const id = `e2e-widget-${String(++nextId)}`;
        callbacks.set(id, options.callback);
        return id;
      },
      reset() {},
    };
  });
}

export async function mockGallery(page: Page, options: { protected?: boolean; retouchEnabled?: boolean; withUnavailablePhoto?: boolean } = {}): Promise<void> {
  let unlocked = !options.protected;
  const favorites = new Map<string, boolean>();
  const retouchSelections = new Map<string, boolean>();
  const event = options.protected
    ? { ...protectedEvent, retouchSelectionEnabled: options.retouchEnabled ?? true }
    : publicEvent;

  await page.route('**/e2e/photo-1.svg*', async (route) => {
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><rect width="720" height="480" fill="#8b5e45"/><circle cx="360" cy="220" r="120" fill="#f1d6ba"/></svg>',
      contentType: 'image/svg+xml',
    });
  });
  await page.route('**/e2e/photo-2.svg*', async (route) => {
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720"><rect width="480" height="720" fill="#486c73"/><circle cx="240" cy="260" r="140" fill="#efc7a5"/></svg>',
      contentType: 'image/svg+xml',
    });
  });

  await page.route('**/media/*/*/*/download', async (route) => {
    await route.fulfill({ body: 'demo image bytes', contentType: 'image/webp' });
  });

  await page.route('**/api/v1/galleries/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const segments = url.pathname.split('/').filter(Boolean);
    const locator = segments[3];
    const tail = segments[4];

    if (request.method() === 'POST' && tail === 'unlock') {
      const payload = request.postDataJSON() as { password?: string; turnstileToken?: string };
      if (payload.password === 'mot-de-passe' && payload.turnstileToken === 'e2e-turnstile-token') {
        unlocked = true;
        await fulfillJson(route, { unlocked: true });
      } else {
        await fulfillJson(route, { code: 'INVALID_EVENT_PASSWORD', message: 'errors.invalidEventPassword', requestId: 'e2e' }, 401);
      }
      return;
    }

    if (locator !== event.slug && locator !== event.id) {
      await fulfillJson(route, { code: 'EVENT_NOT_FOUND', message: 'errors.eventNotFound', requestId: 'e2e' }, 404);
      return;
    }
    if (!unlocked) {
      await fulfillJson(route, { code: 'EVENT_GRANT_REQUIRED', message: 'errors.eventGrantRequired', requestId: 'e2e' }, 401);
      return;
    }
    if (request.method() === 'PUT' && tail === 'photos' && segments[6] === 'favorite') {
      if (!options.protected) {
        await fulfillJson(route, { code: 'EVENT_NOT_FOUND', message: 'errors.eventNotFound', requestId: 'e2e' }, 404);
        return;
      }
      const photoId = segments[5] ?? '';
      const payload = request.postDataJSON() as { liked?: boolean };
      if (typeof payload.liked !== 'boolean') {
        await fulfillJson(route, { code: 'INVALID_REQUEST', message: 'errors.invalidRequest', requestId: 'e2e' }, 400);
        return;
      }
      favorites.set(photoId, payload.liked);
      await fulfillJson(route, { liked: payload.liked });
      return;
    }
    if (request.method() === 'PUT' && tail === 'photos' && segments[6] === 'retouch-selection') {
      if (!options.protected) {
        await fulfillJson(route, { code: 'EVENT_NOT_FOUND', message: 'errors.eventNotFound', requestId: 'e2e' }, 404);
        return;
      }
      const photoId = segments[5] ?? '';
      const payload = request.postDataJSON() as { selected?: boolean };
      if (typeof payload.selected !== 'boolean') {
        await fulfillJson(route, { code: 'INVALID_REQUEST', message: 'errors.invalidRequest', requestId: 'e2e' }, 400);
        return;
      }
      retouchSelections.set(photoId, payload.selected);
      await fulfillJson(route, { selected: payload.selected });
      return;
    }
    if (tail === 'photos') {
      await fulfillJson(route, {
        eventRevision: event.revision,
        nextCursor: null,
        photos: [
          { ...publicPhoto, downloadUrl: `/media/${event.id}/photo-1/2/download`, eventId: event.id, liked: favorites.get('photo-1') ?? false, selectedForRetouch: retouchSelections.get('photo-1') ?? false },
          {
            ...publicPhoto,
            downloadUrl: options.withUnavailablePhoto ? null : `/media/${event.id}/photo-2/2/download`,
            eventId: event.id,
            filename: 'portrait-au-jardin.jpg',
            id: 'photo-2',
            liked: favorites.get('photo-2') ?? false,
            selectedForRetouch: retouchSelections.get('photo-2') ?? false,
            height: 1_800,
            width: 1_200,
            sources: [{ contentType: 'image/jpeg', height: 720, url: '/e2e/photo-2.svg', width: 480 }],
            sortKey: '00000002',
          },
          ...(options.withUnavailablePhoto ? [{
            ...publicPhoto,
            downloadUrl: `/media/${event.id}/photo-3/2/download`,
            eventId: event.id,
            filename: 'portrait-a-la-fete.jpg',
            id: 'photo-3',
            liked: favorites.get('photo-3') ?? false,
            selectedForRetouch: retouchSelections.get('photo-3') ?? false,
            sortKey: '00000003',
          }] : []),
        ],
      });
      return;
    }
    await fulfillJson(route, event);
  });
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

export const test = base.extend<{ turnstileStub: void }>({
  turnstileStub: [async ({ page }, use) => {
    await installTurnstileStub(page);
    await use();
  }, { auto: true }],
});

export { expect };
