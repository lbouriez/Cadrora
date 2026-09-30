import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const settings = {
  siteName: 'Photo studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: 'studio@example.test', contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['maternity'], homeGalleries: { enabled: false, limit: 6 },
  galleryDirectoryEnabled: false, analyticsMeasurementId: null, themeMode: 'light',
  updatedAt: '2026-09-30T00:00:00.000Z',
};

for (const path of ['/services', '/contact']) {
  for (const notice of [true, false]) {
    test(`${path} keeps the main content in place while the owner notice resolves to ${notice}`, async ({ page }) => {
      let release = () => {};
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/api/v1/site', async (route) => {
        await pending;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...settings, constructionNoticeEnabled: notice }) });
      });
      await page.route('**/api/v1/services', async (route) => {
        await pending;
        await route.fulfill({ contentType: 'application/json', body: '[]' });
      });
      try {
        await page.goto(path);
        await expect(page.locator('.public-page-intro')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const before = await page.locator('.public-main').boundingBox();
        const following = page.locator(path === '/services' ? '.process-section' : '.contact-page__expectations');
        expect((await following.boundingBox())?.y).toBeGreaterThan(page.viewportSize()?.height ?? 0);
        release();
        await expect(page.locator('.public-data-region--pending')).toHaveCount(0);
        await expect(page.locator('.public-construction-notice')).toHaveCount(notice ? 1 : 0);
        expect((await page.locator('.public-main').boundingBox())?.y).toBeCloseTo(before?.y ?? NaN, 0);
        await assertNoHorizontalOverflow(page);
      } finally { release(); }
    });
  }
}

test('a priority owner photo loads its display variant while the preview response is still pending', async ({ page }) => {
  let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ...settings, aboutEnabled: true, aboutImageRevision: 2, aboutImageMediumWidth: 1280, aboutImageLargeWidth: 2560,
  }) }));
  await page.route('**/service-media/**', async (route) => {
    if (route.request().url().endsWith('/preview')) await pending;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853"><rect width="1280" height="853" fill="#aaa"/></svg>' });
  });
  try {
    await page.goto('/about');
    const frame = page.locator('.about-page__image');
    await expect(frame).toHaveClass(/progressive-photo--ready/u);
    const source = await frame.locator('.progressive-photo__optimized').evaluate((image) => (image as HTMLImageElement).currentSrc);
    expect(source).toMatch(/\/service-media\/about-hero\/2\/(?:small|medium|large)$/u);
    const size = await frame.evaluate((element) => Math.ceil(element.clientWidth));
    await expect(frame.locator('img[srcset]')).toHaveAttribute('sizes', `${size}px`);
    await assertNoHorizontalOverflow(page);
  } finally { release(); }
});
