import { expect, test } from './fixtures';

const settings = {
  siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
  galleryDirectoryEnabled: false, homeGalleries: { enabled: false, limit: 6 },
  updatedAt: '2026-10-19T00:00:00.000Z',
};

test('disabled URL language redirects with context intact and replaces history', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: settings }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: [] }));
  await page.goto('/fr/privacy');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.goto('/en/contact?session=wedding#details');
  await expect(page).toHaveURL(/\/fr\/contact\?session=wedding#details$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('.public-header__language')).toHaveCount(0);
  await expect(page.locator('link[hreflang="en"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cadrora-language'))).toBe('fr');
  await page.goBack();
  await expect(page).toHaveURL(/\/fr\/privacy\/?$/u);
});

test('English-only policy overrides a French URL too', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
    ...settings, defaultLanguage: 'en', enabledLanguages: ['en'],
  } }));
  await page.goto('/fr/contact');
  await expect(page).toHaveURL(/\/en\/contact\/?$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[hreflang="fr"]')).toHaveCount(0);
});

test('Home waits for owner metadata and falls back only after the request deadline', async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requestedPhotos: string[] = [];
  page.on('request', (request) => {
    if (/\/(?:home-hero-image|service-media|brand\/responsive\/service-)/u.test(request.url())) requestedPhotos.push(request.url());
  });
  await page.route(/\/api\/v1\/(?:site|services)$/u, async (route) => {
    await held;
    await route.abort().catch(() => undefined);
  });
  try {
    await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.site-startup--overlay')).toBeVisible();
    await expect(page.locator('.site-startup__fallback')).toBeAttached();
    expect(requestedPhotos).toEqual([]);
    await page.clock.fastForward(14_000);
    await expect(page.locator('.site-startup')).toBeVisible();
    expect(requestedPhotos).toEqual([]);
    await page.clock.runFor(2_000);
    await expect(page.locator('h1')).toBeAttached();
    await page.clock.runFor(2_000);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  } finally { release(); }
});
