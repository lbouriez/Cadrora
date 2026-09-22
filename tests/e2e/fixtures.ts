import { expect, test as base } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

export const NOW = '2026-09-20T16:00:00.000Z';

export const publicEvent = {
  access: 'public',
  allowDownloads: true,
  coverPhotoId: 'photo-1',
  description: 'Une journee lumineuse au bord du fleuve.',
  faceSearchEnabled: true,
  nearbySearchEnabled: true,
  showPhotoMetadata: true,
  id: 'event-1',
  retentionDays: 30,
  revision: 3,
  slug: 'mariage-lumiere',
  startsAt: NOW,
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
  downloadUrl: '/e2e/photo-1.svg?download=1',
  eventId: publicEvent.id,
  filename: 'danse-au-coucher-du-soleil.jpg',
  height: 1_200,
  id: 'photo-1',
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

export async function mockGallery(page: Page, options: { protected?: boolean } = {}): Promise<void> {
  let unlocked = !options.protected;
  const event = options.protected ? protectedEvent : publicEvent;

  await page.route('**/e2e/photo-1.svg*', async (route) => {
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><rect width="720" height="480" fill="#8b5e45"/><circle cx="360" cy="220" r="120" fill="#f1d6ba"/></svg>',
      contentType: 'image/svg+xml',
    });
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
    if (tail === 'photos') {
      await fulfillJson(route, {
        eventRevision: event.revision,
        nextCursor: null,
        photos: [
          { ...publicPhoto, eventId: event.id },
          {
            ...publicPhoto,
            eventId: event.id,
            filename: 'portrait-au-jardin.jpg',
            id: 'photo-2',
            sortKey: '00000002',
          },
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
