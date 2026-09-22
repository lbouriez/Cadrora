import { expect, test } from './fixtures';

const eventId = 'event-resume';
const importId = 'import-paused';

test('redirige une page admin non authentifiee vers la connexion', async ({ page }) => {
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: /connexion photographe|photographer sign in/i })).toBeVisible();
});

test('reprend au troisieme lot un journal local de 200 photos et rejette un format non pris en charge', async ({ page }) => {
  await page.addInitScript(({ seededEventId, seededImportId }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(url, location.origin).pathname;
      if (init?.method === 'POST' && path.endsWith(`/events/${seededEventId}/imports`)) {
        return new Response(JSON.stringify({
          import: {
            completedPhotos: 100,
            createdAt: '2026-09-20T15:00:00.000Z',
            eventId: seededEventId,
            id: seededImportId,
            state: 'processing',
            totalPhotos: 200,
            updatedAt: '2026-09-20T16:00:00.000Z',
          },
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (init?.method === 'POST' && path.endsWith(`/imports/${seededImportId}/photos`)) {
        const record = globalThis as typeof globalThis & { __cadroraResumedDeclaration?: unknown };
        record.__cadroraResumedDeclaration = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        return new Response(
          JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'errors.unavailable', requestId: 'request-e2e' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 },
        );
      }
      return originalFetch(input, init);
    };
  }, { seededEventId: eventId, seededImportId: importId });

  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/session')) {
      await route.fulfill({
        body: JSON.stringify({
          access: 'manage',
          authMode: 'password',
          createdAt: '2026-09-20T15:00:00.000Z',
          expiresAt: '2026-09-20T23:00:00.000Z',
          id: 'session-e2e',
          revokedAt: null,
          subject: 'photographe@example.test',
        }),
        contentType: 'application/json',
      });
      return;
    }
    if (path.endsWith('/publication')) {
      await route.fulfill({
        body: JSON.stringify({
          eventId, indexingPhotos: 0, offlineAt: null, publishedAt: null,
          publishedPhotos: 0, readyPhotos: 0, totalPhotos: 0, visibility: 'draft',
        }),
        contentType: 'application/json',
      });
      return;
    }
    await route.fulfill({ body: '{}', contentType: 'application/json', status: 404 });
  });

  await page.goto('/admin/login');
  await page.evaluate(async ({ eventId: seededEventId, importId: seededImportId }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('cadrora-import-journal', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const jobs = database.createObjectStore('jobs', { keyPath: 'id' });
        jobs.createIndex('eventId', 'eventId', { unique: false });
        database.createObjectStore('chunks', { keyPath: ['importId', 'number'] });
        database.createObjectStore('files', { keyPath: ['importId', 'sourceIndex'] });
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB setup failed'));
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['jobs', 'chunks', 'files'], 'readwrite');
        transaction.objectStore('jobs').put({
          createdAt: '2026-09-20T15:00:00.000Z',
          eventId: seededEventId,
          id: seededImportId,
          state: 'paused',
          totalPhotos: 200,
          updatedAt: '2026-09-20T16:00:00.000Z',
        });
        const chunks = transaction.objectStore('chunks');
        const files = transaction.objectStore('files');
        for (let chunkNumber = 0; chunkNumber < 4; chunkNumber += 1) {
          const photos = Array.from({ length: 50 }, (_, offset) => {
            const sourceIndex = chunkNumber * 50 + offset;
            return {
              contentType: 'image/jpeg',
              filename: `photo-${sourceIndex + 1}.jpg`,
              height: 800,
              id: `photo-${String(sourceIndex + 1).padStart(3, '0')}`,
              sourceIndex,
              sortKey: String(sourceIndex).padStart(8, '0'),
              state: chunkNumber < 2 ? 'finalized' : 'pending',
              width: 1200,
            };
          });
          chunks.put({
            importId: seededImportId,
            number: chunkNumber,
            photos,
            state: chunkNumber < 2 ? 'finalized' : 'pending',
            updatedAt: '2026-09-20T16:00:00.000Z',
          });
          for (const photo of photos) {
            files.put({
              file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], photo.filename, { type: 'image/jpeg' }),
              importId: seededImportId,
              sourceIndex: photo.sourceIndex,
            });
          }
        }
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB seed failed'));
      };
    });
  }, { eventId, importId });

  await page.evaluate((id) => {
    history.pushState({}, '', `/admin/events/${id}/import`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, eventId);

  await expect(page.getByRole('heading', { name: /démarrer l'importation|start import/i })).toBeVisible();
  const resume = page.getByRole('button', { name: /reprendre l'importation|resume import/i });
  await expect(resume).toBeVisible();

  await resume.click();
  await expect(page.getByText('100/200')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/pause|paused/i);
  const resumedDeclaration = await page.evaluate(() => {
    const record = globalThis as typeof globalThis & { __cadroraResumedDeclaration?: unknown };
    return record.__cadroraResumedDeclaration;
  }) as { chunkNumber: number; photos: unknown[] } | undefined;
  expect(resumedDeclaration?.chunkNumber).toBe(2);
  expect(resumedDeclaration?.photos).toHaveLength(50);

  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('not an image'),
    mimeType: 'text/plain',
    name: 'notes.txt',
  });
  await expect(page.getByText(/notes\.txt/)).toContainText(/seuls les fichiers JPEG|only JPEG/i);
});
