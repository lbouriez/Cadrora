import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const siteSettingsFixture = {
  siteName: 'Atelier Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  enabledServices: ['wedding', 'family', 'brand', 'corporate', 'children'],
  analyticsMeasurementId: null, themeMode: 'both', updatedAt: '2026-09-23T00:00:00.000Z',
};

test.describe('site vitrine statique', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/galleries', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ code: 'E2E_GALLERY_OFFLINE', message: 'errors.serviceUnavailable', requestId: 'e2e' }),
        contentType: 'application/json',
        status: 503,
      });
    });
  });

  test('reste utile lorsque les galeries sont indisponibles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/chaque photo|every photo/i);
    await expect(page.getByRole('heading', { name: /photographie profondément personnelle|photography made personal/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/temporairement indisponibles|temporarily unavailable/i);
    await expect(page.getByRole('link', { name: /essayer le chercheur ia|try the ai photo finder|tester l’ia|try ai search/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('publie les coordonnees sans formulaire ni dependance distante', async ({ page }) => {
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          ...siteSettingsFixture,
          map: { centerLatitude: 45.5019, centerLongitude: -73.5674, radiusKm: 175 },
        }),
        contentType: 'application/json',
      });
    });
    const remoteRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4178') remoteRequests.push(request.url());
    });

    await page.goto('/contact');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/créons quelque chose|create something/i);
    await expect(page.getByRole('link', { name: '+1 514 555 0142' })).toHaveAttribute('href', 'tel:+15145550142');
    await expect(page.getByRole('link', { name: 'bonjour@example.test' })).toHaveAttribute('href', 'mailto:bonjour@example.test');
    await expect(page.getByText('123 rue Lumiere, Montreal')).toBeVisible();
    await expect(page.getByText('Montreal et environs')).toBeVisible();
    await expect(page.getByRole('heading', { name: /là où nous créons|where we create/i })).toBeVisible();
    await expect(page.getByText(/175 km/)).toBeVisible();
    await expect(page.locator('.service-area-map__preview-image')).toBeVisible();
    await expect(page.locator('.service-area-map__preview')).toContainText(/afficher la carte|display the map/i);
    await expect(page.getByText(/map is supplied by OpenStreetMap|carte est fournie par OpenStreetMap/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /zone de service sur google maps|service area in google maps/i })).toBeVisible();
    await expect(page.locator('iframe[src*="google.com/maps"], iframe[src*="openstreetmap.org"]')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    expect(remoteRequests).toEqual([]);

    await page.route('https://www.openstreetmap.org/export/embed.html?**', (route) => route.abort());
    await page.getByRole('button', { name: /afficher la carte|display the map/i }).click();
    await expect(page.locator('iframe[src*="openstreetmap.org/export/embed.html"]')).toHaveCount(1);
    await expect(page.locator('.service-area-map__preview')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /OpenStreetMap contributors/i })).toBeVisible();
  });

  test('ne montre pas de carte si le rayon est absent des reglages', async ({ page }) => {
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          ...siteSettingsFixture,
          map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
        }),
        contentType: 'application/json',
      });
    });
    await page.goto('/contact');
    await expect(page.locator('.service-area-map')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('reveals landing cards with motion unless the visitor requests reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
    await page.goto('/');
    const heroArt = page.locator('.site-hero__art');
    await expect(heroArt).toHaveClass(/motion-reveal--scale/);
    await expect(heroArt).toHaveClass(/motion-reveal--visible/);
    expect(await heroArt.evaluate((element) => getComputedStyle(element).transitionDuration)).not.toBe('0s');
    const demoCard = page.locator('.demo-experience-card').first();
    await demoCard.scrollIntoViewIfNeeded();
    await expect(demoCard).toHaveClass(/motion-reveal--visible/);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await demoCard.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  });

  test('relie les services, les demonstrations et la confidentialite', async ({ page }) => {
    await page.goto('/services');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/images sensibles|photography with feeling/i);
    await expect(page.getByRole('heading', { name: /mariages|weddings/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /photographie corporative|corporate photography/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /enfance et enfants|children and childhood/i })).toBeVisible();
    await expect(page.locator('.service-detail-card__image')).toHaveCount(5);
    await assertNoHorizontalOverflow(page);

    await page.goto('/galleries');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/histoires à retrouver|stories to return/i);
    await expect(page.getByRole('heading', { name: /explorer les collections|explore the collections/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /tester le chercheur de photos ia|test the ai photo finder/i })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /IA facultative et recherche faciale|optional AI and face search/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /témoins et mesure d'audience|cookies and analytics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nécessaire seulement|necessary only/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('ne conserve pas de redirection depuis l ancienne route events', async ({ page }) => {
    await page.goto('/events');

    await expect(page).toHaveURL(/\/events$/u);
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText(/histoires à retrouver|stories to return/i);
  });

  test('garde la navigation et les actions principales compactes sur telephone', async ({ page }) => {
    await page.setViewportSize({ width: 330, height: 740 });
    await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
    await page.goto('/');

    const header = page.locator('.public-header');
    expect((await header.boundingBox())?.height).toBeLessThan(85);
    const actions = await page.locator('.site-actions .button').all();
    expect(actions).toHaveLength(2);
    const actionRows = await page.locator('.site-actions .button').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
    expect(Math.abs((actionRows[0] ?? 0) - (actionRows[1] ?? 0))).toBeLessThan(1);
    const portrait = await page.locator('.site-hero__ai-card img').boundingBox();
    expect(portrait?.height).toBeLessThan(80);
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /ouvrir le menu|open menu/i }).click();
    await expect(page.getByRole('navigation', { name: /navigation principale|primary navigation/i })).toBeVisible();
    await page.getByRole('navigation', { name: /navigation principale|primary navigation/i }).getByRole('link', { name: /services/i }).click();
    await expect(page.getByRole('button', { name: /ouvrir le menu|open menu/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('garde la legende photo lisible en theme sombre', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cadrora-theme', 'dark');
      localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
    });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const caption = page.locator('.site-hero__art figcaption');
    await expect(caption).toBeVisible();
    expect(await caption.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
    expect(await caption.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test('presente les galeries publiees avec une couverture plein cadre et les visages visibles', async ({ page }) => {
  await page.route('**/api/v1/galleries', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        events: [{
          id: 'demo-ai-face-search', slug: 'find-your-photos', title: 'Find your photos',
          description: 'A portrait gallery', startsAt: '2026-09-20T15:00:00.000Z',
          timezone: 'America/Toronto', coverPhotoId: null, visibility: 'published',
          access: 'public', allowDownloads: true, faceSearchEnabled: true,
          nearbySearchEnabled: true, showPhotoMetadata: true, retentionDays: null,
          revision: 1, updatedAt: '2026-09-20T15:00:00.000Z',
        }],
      }),
      contentType: 'application/json',
    });
  });

  await page.goto('/galleries');
  await expect(page.getByRole('heading', { name: 'Find your photos' })).toBeVisible();
  const image = page.locator('.event-card__visual--ai img');
  await expect(image).toBeVisible();
  expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('cover');
  await expect(image).toHaveAttribute('src', '/brand/demo-ai-cover.webp');
  expect(await image.evaluate((element) => getComputedStyle(element).objectPosition)).toBe('50% 8%');
  await assertNoHorizontalOverflow(page);
});
