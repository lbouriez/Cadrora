import { expect, test } from './fixtures';

test('language choice stays visually aligned with navigation at desktop and phone sizes', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
      updatedAt: '2026-09-25T00:00:00.000Z',
    }),
  }));
  await page.route('**/api/v1/galleries', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [] }),
  }));

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const language = page.locator('.public-header__language');
    await expect(language).toBeVisible();
    const appearance = await language.evaluate((element) => {
      const style = getComputedStyle(element);
      const nav = document.querySelector('.public-nav a');
      return {
        fontSize: Number.parseFloat(style.fontSize),
        navFontSize: nav ? Number.parseFloat(getComputedStyle(nav).fontSize) : 0,
        pseudoContent: getComputedStyle(element, '::before').content,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      };
    });
    expect(appearance.fontSize).toBeLessThanOrEqual(appearance.navFontSize);
    expect(appearance.pseudoContent).toBe('none');
    expect(appearance.width).toBeGreaterThanOrEqual(44);
    expect(appearance.height).toBeGreaterThanOrEqual(44);
  }
});
