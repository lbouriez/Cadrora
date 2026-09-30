import { assertNoHorizontalOverflow, expect, mockGallery, test } from './fixtures';
import type { Page } from '@playwright/test';

async function assertSharedImages(page: Page) {
  expect(await page.locator('img').evaluateAll((images) => images
    .filter((image) => !image.closest('.progressive-photo')).map((image) => image.outerHTML))).toEqual([]);
  await assertNoHorizontalOverflow(page);
}

test('public routes and gallery viewer share the image renderer', async ({ page }, testInfo) => {
  const language = testInfo.project.name === 'mobile-chromium' ? 'en' : 'fr';
  await page.addInitScript((value) => localStorage.setItem('cadrora-language', value), language);
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }),
  }));
  await mockGallery(page);
  for (const path of ['/', '/services', '/about', '/contact', '/privacy', '/portfolio', '/portfolio/absent', '/galleries', '/missing']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('img').first()).toBeAttached();
    if (path === '/') {
      const necessary = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
      if (await necessary.isVisible()) await necessary.click();
      const logo = page.locator('.public-brand__logo');
      if (process.env.CADRORA_SITE === 'atelier-giulia') await expect(logo).toBeHidden();
      else {
        await expect(logo).toBeVisible();
        const bounds = await logo.boundingBox();
        expect(bounds?.width).toBeCloseTo(40, 0);
        expect(bounds?.height).toBeCloseTo(40, 0);
      }
      await page.screenshot({ path: testInfo.outputPath('public-home.png') });
    }
    await assertSharedImages(page);
  }
  await page.goto('/e/mariage-lumiere');
  await expect(page.locator('.photo-grid .progressive-photo')).toHaveCount(2);
  await assertSharedImages(page);
  await page.goto('/e/mariage-lumiere/photo/photo-1');
  await expect(page.locator('.photo-viewer .progressive-photo').first()).toBeVisible();
  await assertSharedImages(page);
});

test('face-search portraits, results, and local preview preserve their framing', async ({ page }, testInfo) => {
  await page.addInitScript((value) => localStorage.setItem('cadrora-language', value),
    testInfo.project.name === 'mobile-chromium' ? 'en' : 'fr');
  await mockGallery(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cadrora:face-search:mariage-lumiere', JSON.stringify({
      matchedPhotos: [{ capturedAt: null, momentId: null, photoId: 'photo-1', revision: 2, thumbnailUrl: '/e2e/photo-1.svg' }],
      nearbyPhotos: [{ capturedAt: null, momentId: null, photoId: 'photo-2', revision: 2, thumbnailUrl: '/e2e/photo-2.svg' }],
      savedAt: '2026-09-21T18:00:00.000Z',
    }));
  });
  const originalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/demo/face-search/')) originalRequests.push(request.url());
  });
  await page.goto('/e/mariage-lumiere/find');
  const necessary = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
  if (await necessary.isVisible()) await necessary.click();
  if (process.env.CADRORA_SITE !== 'atelier-giulia') {
    const portraits = page.locator('.face-find__test-photo');
    await expect(portraits).toHaveCount(3);
    await portraits.first().scrollIntoViewIfNeeded();
    await expect.poll(() => portraits.first().locator('.progressive-photo__optimized')
      .evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await portraits.first().locator('.progressive-photo__optimized')
      .evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeLessThanOrEqual(320);
    await expect(page.locator('.face-find__test-card').first()).toHaveAttribute('href', '/demo/face-search/test-portrait-amelia.webp');
    expect(originalRequests).toEqual([]);
  }
  const results = page.locator('.face-result__photo');
  await expect(results).toHaveCount(2);
  for (const result of await results.all()) {
    await result.scrollIntoViewIfNeeded();
    const bounds = await result.boundingBox();
    expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(4 / 3, 2);
  }
  await page.getByRole('checkbox').check();
  await page.locator('input[type="file"]').first().setInputFiles('public/demo/face-search/test-portrait-amelia.webp');
  const preview = page.locator('.face-find__preview > img');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('src', /^blob:/u);
  const imageBounds = await preview.boundingBox();
  const stageBounds = await page.locator('.face-find__preview-stage').boundingBox();
  expect(imageBounds?.width).toBeCloseTo(stageBounds?.width ?? 0, 1);
  expect(imageBounds?.height).toBeCloseTo(stageBounds?.height ?? 0, 1);
  expect((imageBounds?.width ?? 0) / (imageBounds?.height ?? 1)).toBeCloseTo(1086 / 1448, 2);
  await assertSharedImages(page);
  await page.locator('.face-find__preview-stage').screenshot({ path: testInfo.outputPath('face-preview.png') });
});
