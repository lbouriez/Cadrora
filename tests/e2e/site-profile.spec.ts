import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.skip(process.env.CADRORA_SITE !== 'atelier-giulia', 'Run with CADRORA_SITE=atelier-giulia.');

test('Atelier Giulia inherits the shared site without demo journeys or invented contact details', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }) }));
  await page.goto('/');

  await expect(page).toHaveTitle('Atelier Giulia');
  await expect(page.locator('html')).toHaveAttribute('data-site', 'atelier-giulia');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/votre histoire|your story/i);
  await expect(page.locator('.public-brand')).toContainText('Atelier Giulia');
  await expect(page.locator('.public-footer')).toContainText('Des images pleines de vie.');
  const credit = page.locator('.public-footer__credit');
  await expect(credit).toHaveAttribute('href', 'https://cadrora.com/');
  await expect(credit).toHaveText('par Cadrora');
  await expect(credit.locator('img')).toHaveAttribute('src', '/brand/cadrora-logo.png');
  const signatureAlignment = () => page.locator('.public-footer__signature').evaluate((signature) => {
    const label = signature.querySelector('p');
    const link = signature.querySelector('a');
    if (!label || !link) return false;
    const labelBox = label.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    return Math.abs(labelBox.top + labelBox.height / 2 - linkBox.top - linkBox.height / 2) < 2;
  });
  expect(await signatureAlignment()).toBe(true);
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
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: /privacy policy|politique de confidentialité/i })).toBeVisible();
  await expect(page.locator('#privacy-operator')).toContainText('Atelier Giulia');
  await expect(page.locator('.privacy-page__updated')).not.toContainText(/demo|démonstration/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.goto('/');
  await assertNoHorizontalOverflow(page);
  expect(await signatureAlignment()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('owner-edited brand copy updates both languages without changing the designed home page', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Studio Boréal', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    siteCopy: {
      fr: { description: 'Portraits du Québec.', footerTagline: 'Des histoires à garder.' },
      en: { description: 'Portraits from Québec.', footerTagline: 'Stories to keep.' },
    },
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: true, limit: 6 }, homeServicesLimit: 3, updatedAt: '2026-09-26T12:00:00.000Z',
  }) }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }),
  }));
  await page.goto('/');
  await expect(page).toHaveTitle('Studio Boréal');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Portraits du Québec.');
  await expect(page.locator('.public-footer')).toContainText('© Studio Boréal · Des histoires à garder.');
  await expect(page.locator('.public-footer__credit')).toHaveText('par Cadrora');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre histoire');

  await page.locator('.public-header__language').click();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Portraits from Québec.');
  await expect(page.locator('.public-footer')).toContainText('© Studio Boréal · Stories to keep.');
  await expect(page.locator('.public-footer__credit')).toHaveText('by Cadrora');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your story');
});

test('three owner buttons keep their theme styles and fit a phone screen', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: false, limit: 6 }, homeServicesLimit: 3,
    homeHeroCopy: {
      fr: { label: 'Des images', title: 'Votre histoire', description: 'Des photos à garder.', caption: '', imageAlt: 'Un couple souriant' },
      en: { label: 'Images', title: 'Your story', description: 'Photos to keep.', caption: '', imageAlt: 'A smiling couple' },
      buttons: [
        { labels: { fr: 'Nous contacter', en: 'Contact us' }, href: '/contact', variant: 'primary' },
        { labels: { fr: 'Services', en: 'Services' }, href: '/services', variant: 'secondary' },
        { labels: { fr: 'Galeries', en: 'Galleries' }, href: '/galleries', variant: 'primary' },
      ],
    },
    updatedAt: '2026-09-27T00:00:00.000Z',
  }) }));
  await page.goto('/');
  const actions = page.locator('.site-hero .site-actions .button');
  await expect(actions).toHaveCount(3);
  await expect(actions.nth(2)).toHaveClass(/button--primary/u);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  const first = await actions.first().boundingBox();
  const last = await actions.last().boundingBox();
  expect((last?.width ?? 0) > (first?.width ?? 0)).toBe(true);
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
      homeGalleries: { enabled: true, limit: 6 },
      homeServicesLimit: 3,
      updatedAt: '2026-09-25T00:00:00.000Z',
    }) });
  });
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }),
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

test('home stories obey their visibility and limit while the directory stays complete', async ({ page }) => {
  let enabled = true;
  const createdAt = '2026-09-26T12:00:00.000Z';
  const gallery = (id: string, title: string, startsAt: string) => ({
    id, slug: id, title, description: null, service: null, startsAt, timezone: 'America/Toronto',
    coverPhotoId: null, visibility: 'published', access: 'public', allowDownloads: false,
    faceSearchEnabled: false, nearbySearchEnabled: false, showPhotoMetadata: false,
    retouchSelectionEnabled: false, retentionDays: null, revision: 1,
    createdAt, updatedAt: createdAt, coverPhotoUrl: null,
  });
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled, limit: 2 }, homeServicesLimit: 3, updatedAt: createdAt,
  }) }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    events: [
      gallery('older', 'Older story', '2020-01-01T12:00:00.000Z'),
      gallery('newer', 'Newer story', '2022-01-01T12:00:00.000Z'),
      gallery('middle', 'Middle story', '2021-01-01T12:00:00.000Z'),
    ],
    protectedGalleries: [], nextCursor: null,
  }) }));

  await page.goto('/');
  await expect(page.locator('#galleries .event-card h3')).toHaveText(['Newer story', 'Middle story']);
  await page.goto('/galleries');
  await expect(page.locator('.event-card h3')).toHaveText(['Newer story', 'Middle story', 'Older story']);

  enabled = false;
  await page.goto('/');
  await expect(page.locator('#galleries')).toHaveCount(0);
  await page.goto('/galleries');
  await expect(page.locator('.event-card')).toHaveCount(3);
});

test('gallery directory fetches one bounded page and loads more on scroll', async ({ page }) => {
  const createdAt = '2026-09-26T12:00:00.000Z';
  const gallery = (index: number) => ({
    id: `gallery-${String(index).padStart(3, '0')}`, slug: `gallery-${String(index).padStart(3, '0')}`,
    title: `Story ${index}`, description: null, service: index === 0 ? 'wedding' : null,
    startsAt: new Date(Date.UTC(2026, 8, 26 - index, 12)).toISOString(), timezone: 'America/Toronto',
    coverPhotoId: null, coverPhotoUrl: null, visibility: 'published', access: 'public',
    allowDownloads: false, faceSearchEnabled: false, nearbySearchEnabled: false,
    showPhotoMetadata: false, retouchSelectionEnabled: false, retentionDays: null, revision: 1,
    createdAt, updatedAt: createdAt,
  });
  const requests: string[] = [];
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const next = url.searchParams.get('cursor') === 'page-2';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      events: next ? [gallery(24)] : Array.from({ length: 24 }, (_, index) => gallery(index)),
      protectedGalleries: [], nextCursor: next ? null : 'page-2',
    }) });
  });

  await page.goto('/galleries');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('.event-card')).toHaveCount(24);
  expect(requests).toHaveLength(1);
  await page.locator('.gallery-load-sentinel').scrollIntoViewIfNeeded();
  await expect(page.locator('.event-card')).toHaveCount(25);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toContain('limit=24');
  expect(requests[1]).toContain('cursor=page-2');
  await expect(page.locator('.event-card').first().locator('.event-card__service')).toHaveText('Mariage');
  await expect(page.getByRole('button', { name: /charger plus de galeries|load more galleries/i })).toHaveCount(0);
});

test('runtime language wins until a visitor makes and keeps a choice', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'en', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: false, limit: 6 }, homeServicesLimit: 3, updatedAt: '2026-09-26T12:00:00.000Z',
  }) }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.public-header__language').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
