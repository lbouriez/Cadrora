import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.skip(process.env.CADRORA_SITE !== 'atelier-giulia', 'Run with CADRORA_SITE=atelier-giulia.');

test('Atelier Giulia inherits the shared site without demo journeys or invented contact details', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/v1/galleries', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [] }) }));
  await page.goto('/');

  await expect(page).toHaveTitle('Atelier Giulia');
  await expect(page.locator('html')).toHaveAttribute('data-site', 'atelier-giulia');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/votre histoire|your story/i);
  await expect(page.locator('.public-brand')).toContainText('Atelier Giulia');
  await expect(page.locator('.public-brand img')).toHaveAttribute('src', '/brand/atelier-giulia-logo.png');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/atelier-giulia-icon.png');
  await expect(page.locator('.site-section--demo')).toHaveCount(0);
  await expect(page.locator('.product-stack')).toHaveCount(0);
  await expect(page.locator('.site-hero__ai-card')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /admin demo|démo admin/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /find photos with ai|retrouver des photos avec l’ia/i })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await page.goto('/services');
  await expect(page.locator('.service-detail-card')).toHaveCount(5);
  await page.goto('/contact');
  await expect(page.locator('.contact-page__unconfigured')).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await assertNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('fixed light appearance does not flash a dark theme or a theme switch while settings load', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadrora-theme', 'dark'));
  let releaseSettings: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { releaseSettings = resolve; });
  await page.route('**/api/v1/site', async (route) => {
    await waiting;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['wedding'], analyticsMeasurementId: 'G-ABCDEF12', themeMode: 'light',
      updatedAt: '2026-09-25T00:00:00.000Z',
    }) });
  });
  await page.route('**/api/v1/galleries', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [] }),
  }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.public-header__theme')).toHaveCount(0);
  const beforeConsent = await page.locator('.privacy-consent').boundingBox();
  releaseSettings?.();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.public-header__theme')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /autoriser l'analyse|allow analytics/i })).toBeVisible();
  const afterConsent = await page.locator('.privacy-consent').boundingBox();
  expect(Math.abs((afterConsent?.y ?? 0) - (beforeConsent?.y ?? 0))).toBeLessThan(1);
  expect(Math.abs((afterConsent?.height ?? 0) - (beforeConsent?.height ?? 0))).toBeLessThan(1);
});
