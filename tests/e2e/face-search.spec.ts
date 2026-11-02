import { expect, test } from './fixtures';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('garde la photo locale avant toute recherche faciale', async ({ page }) => {
  const faceApiRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/v1/galleries/') && path.endsWith('/face-search')) faceApiRequests.push(request.url());
  });

  await page.goto('/e/mariage-lumiere/find');
  await expect(page.locator('.face-find__test-portraits')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({ buffer: tinyPng, mimeType: 'image/png', name: 'selfie.png' });

  await expect(page.getByRole('img', { name: /photo choisie pour la recherche faciale|photo selected for face search/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /trouver un visage|find a face/i })).toBeVisible();
  expect(faceApiRequests).toEqual([]);
});

test('selects a fictional portrait locally after consent and clears it on withdrawal', async ({ page }) => {
  test.skip(process.env.CADRORA_SITE === 'atelier-giulia', 'Showcase-only portrait shortcut.');
  const sensitiveRequests: string[] = [];
  const portraitRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/models/') || path.endsWith('/face-search')) sensitiveRequests.push(path);
    if (/^\/demo\/face-search\/test-portrait-.*\.webp$/u.test(path)) portraitRequests.push(path);
  });
  await page.goto('/e/find-your-photos/find');
  const cards = page.locator('.face-find__test-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toBeDisabled();
  expect(portraitRequests).toEqual([]);
  await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
  await page.getByRole('checkbox').check();
  await cards.first().click();
  await expect(page.locator('.face-find__preview img').last()).toBeVisible();
  expect(portraitRequests).toHaveLength(1);
  expect(sensitiveRequests).toEqual([]);
  await page.getByRole('checkbox').uncheck();
  await expect(page.locator('.face-find__preview')).toHaveCount(0);
  await expect(cards.first()).toBeDisabled();
  await expect(page.getByRole('button', { name: /trouver un visage|find a face/i })).toHaveCount(0);
  expect(sensitiveRequests).toEqual([]);
});

test('withdrawal cancels a pending sample portrait selection', async ({ page }) => {
  test.skip(process.env.CADRORA_SITE === 'atelier-giulia', 'Showcase-only portrait shortcut.');
  let release = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/\/demo\/face-search\/test-portrait-.*\.webp$/u, async route => {
    requested = true;
    await waiting;
    await route.fulfill({ contentType: 'image/png', body: tinyPng });
  });
  try {
    await page.goto('/e/find-your-photos/find');
    await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
    await page.getByRole('checkbox').check();
    await page.locator('.face-find__test-card').first().click();
    await expect.poll(() => requested).toBe(true);
    await page.getByRole('checkbox').uncheck();
    release();
    await expect(page.locator('.face-find__preview')).toHaveCount(0);
    await page.getByRole('checkbox').check();
    await expect(page.locator('.face-find__test-card').first()).toBeEnabled();
    await expect(page.locator('.face-find__preview')).toHaveCount(0);
  } finally { release(); }
});
