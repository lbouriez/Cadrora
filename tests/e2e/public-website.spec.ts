import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const siteSettingsFixture = {
  siteName: 'Atelier Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
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

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/vos moments préférés|the moments you came for/i);
    await expect(page.getByRole('heading', { name: /des photos qui vous ressemblent|photos that feel like you/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/ne sont pas disponibles pour le moment|unavailable right now/i);
    await expect(page.getByRole('link', { name: /retrouver des photos avec l’ia|find photos with ai/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('publie les coordonnees sans formulaire ni dependance distante', async ({ page }) => {
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          ...siteSettingsFixture,
          contactEmail: 'studio@runtime.example',
          contactPhone: '+1 438 555-0199',
          contactAddress: '456 rue du Studio, Québec',
          serviceArea: 'Québec et Charlevoix',
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
    await expect(page.getByRole('link', { name: '+1 438 555-0199' })).toHaveAttribute('href', 'tel:+14385550199');
    await expect(page.getByRole('link', { name: 'studio@runtime.example' })).toHaveAttribute('href', 'mailto:studio@runtime.example');
    await expect(page.getByText('456 rue du Studio, Québec')).toBeVisible();
    await expect(page.getByText('Québec et Charlevoix')).toBeVisible();
    await expect(page.getByText('bonjour@example.test')).toHaveCount(0);
    await expect(page.getByText(/coordonnées sont fictives|demonstration details/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /là où nous créons|where we create/i })).toBeVisible();
    await expect(page.getByText(/175 km/)).toBeVisible();
    await expect(page.locator('.service-area-map__preview-image')).toBeVisible();
    await expect(page.locator('.service-area-map__preview')).toContainText(/afficher la carte|display the map/i);
    const previewGap = await page.locator('.service-area-map__visual').evaluate((visual) =>
      visual.getBoundingClientRect().bottom - visual.querySelector('.service-area-map__preview')!.getBoundingClientRect().bottom);
    expect(Math.abs(previewGap)).toBeLessThan(1);
    await expect(page.getByText(/map is supplied by OpenStreetMap|carte est fournie par OpenStreetMap/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /zone de service sur google maps|service area in google maps/i })).toBeVisible();
    await expect(page.locator('iframe[src*="google.com/maps"], iframe[src*="openstreetmap.org"]')).toHaveCount(0);
    await expect(page.locator('form')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    expect(remoteRequests).toEqual([]);

    await page.route('https://www.openstreetmap.org/export/embed.html?**', (route) => route.abort());
    await page.getByRole('button', { name: /afficher la carte|display the map/i }).click();
    await expect(page.locator('iframe[src*="openstreetmap.org/export/embed.html"]')).toHaveCount(1);
    await expect(page.locator('iframe[src*="layer=shortbread"]')).toHaveCount(1);
    await expect(page.locator('.service-area-map__preview')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /OpenStreetMap contributors/i })).toBeVisible();
  });

  test('charge GA4 avec un identifiant D1 fictif seulement après consentement', async ({ page }) => {
    const measurementId = 'G-TEST123456';
    const tagRequests: string[] = [];
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ ...siteSettingsFixture, analyticsMeasurementId: measurementId }),
        contentType: 'application/json',
      });
    });
    await page.route('https://www.googletagmanager.com/gtag/js?**', async (route) => {
      tagRequests.push(route.request().url());
      await route.fulfill({ body: '', contentType: 'text/javascript' });
    });

    await page.goto('/contact');
    await expect(page.locator('script[data-cadrora-analytics]')).toHaveCount(0);
    expect(tagRequests).toEqual([]);

    await page.getByRole('button', { name: /autoriser l'analyse|allow analytics/i }).click();
    await expect(page.locator('script[data-cadrora-analytics]')).toHaveAttribute('src', `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
    await expect.poll(() => tagRequests.length).toBe(1);
    expect(await page.evaluate(() => (window as Window & { dataLayer?: unknown[][] }).dataLayer?.some((entry) => entry[0] === 'event' && entry[1] === 'page_view' && (entry[2] as { page_path?: string }).page_path === '/contact' && Object.prototype.toString.call(entry) === '[object Arguments]'))).toBe(true);

    await page.getByRole('link', { name: /accueil|home/i }).first().click();
    await expect(page).toHaveURL('/');
    await expect.poll(() => page.evaluate(() => (window as Window & { dataLayer?: unknown[][] }).dataLayer?.some((entry) => entry[0] === 'event' && entry[1] === 'page_view' && (entry[2] as { page_path?: string }).page_path === '/'))).toBe(true);
    expect(await page.evaluate(() => (window as Window & { dataLayer?: unknown[][] }).dataLayer?.some((entry) => entry[0] === 'consent' && entry[1] === 'update' && (entry[2] as { analytics_storage?: string }).analytics_storage === 'denied'))).toBe(false);
    expect(tagRequests).toHaveLength(1);
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

  test('garde le repli compilé si D1 est indisponible, mais respecte les champs D1 vidés', async ({ page }) => {
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ code: 'SITE_OFFLINE', message: 'errors.serviceUnavailable', requestId: 'e2e' }),
        contentType: 'application/json',
        status: 503,
      });
    });
    await page.goto('/contact');
    await expect(page.getByRole('link', { name: 'bonjour@example.test' })).toBeVisible();

    await page.unroute('**/api/v1/site');
    await page.route('**/api/v1/site', async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          ...siteSettingsFixture,
          contactEmail: '', contactPhone: '', contactAddress: '', serviceArea: '',
          map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
        }),
        contentType: 'application/json',
      });
    });
    await page.reload();
    await expect(page.getByRole('link', { name: 'bonjour@example.test' })).toHaveCount(0);
    await expect(page.getByText(/nos coordonnées seront bientôt disponibles|our contact details will be available here soon/i)).toBeVisible();
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/photos pour les moments|photography for the moments/i);
    await expect(page.getByRole('heading', { name: /mariages|weddings/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /photos d’entreprise|workplace photography/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /portraits d’enfants|children’s portraits/i })).toBeVisible();
    await expect(page.locator('.service-detail-card__image')).toHaveCount(5);
    await assertNoHorizontalOverflow(page);

    await page.goto('/galleries');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/histoires à retrouver|stories to return/i);
    await expect(page.getByRole('heading', { name: /explorer les collections|explore the collections/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /essayer la recherche de photos avec l’ia|try finding photos with ai/i })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /IA facultative et recherche faciale|optional AI and face search/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /comment nous comptons les visites|how we count visits/i })).toBeVisible();
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
  await page.route('**/media/demo-ai-face-search/demo-ai-01/0/*', async (route) => {
    await route.fulfill({ body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ad806a"/></svg>', contentType: 'image/svg+xml' });
  });
  await page.route('**/api/v1/galleries', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        events: [{
          id: 'demo-ai-face-search', slug: 'find-your-photos', title: 'Find your photos',
          description: 'A portrait gallery', startsAt: '2026-09-20T15:00:00.000Z',
          timezone: 'America/Toronto', coverPhotoId: 'demo-ai-01', coverPhotoUrl: '/media/demo-ai-face-search/demo-ai-01/0/medium', visibility: 'published',
          access: 'public', allowDownloads: true, faceSearchEnabled: true,
          nearbySearchEnabled: true, showPhotoMetadata: true, retouchSelectionEnabled: true, retentionDays: null,
          revision: 1, createdAt: '2026-09-18T15:00:00.000Z', updatedAt: '2026-09-20T15:00:00.000Z',
        }],
        protectedGalleries: [{
          id: 'private-sample', slug: 'family-afternoon', title: 'A family afternoon', description: 'An afternoon worth keeping.',
          startsAt: '2026-09-21T15:00:00.000Z', createdAt: '2026-09-19T15:00:00.000Z',
        }],
      }),
      contentType: 'application/json',
    });
  });
  await page.route('**/api/v1/galleries/private-sample', async (route) => {
    await route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ code: 'EVENT_ACCESS_REQUIRED', message: 'errors.eventAccessRequired', requestId: 'e2e' }),
    });
  });
  await page.route('**/api/v1/galleries/private-sample/preview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'private-sample', slug: 'family-afternoon', title: 'A family afternoon',
        description: 'An afternoon worth keeping.', startsAt: '2026-09-21T15:00:00.000Z',
        createdAt: '2026-09-19T15:00:00.000Z',
      }),
    });
  });

  await page.goto('/galleries', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Find your photos' })).toBeVisible();
  const cover = page.locator('.event-card:not(.event-card--protected) .progressive-photo');
  const image = cover.locator('.progressive-photo__preview');
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 800);
  expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('cover');
  await expect(image).toHaveAttribute('src', '/media/demo-ai-face-search/demo-ai-01/0/thumb');
  await expect(cover.locator('.progressive-photo__optimized')).toHaveAttribute('srcset', /480w.*960w.*1600w/u);
  await expect(cover).toHaveClass(/progressive-photo--ready/u);
  await expect(page.locator('.event-card').first().locator('a')).toHaveAttribute('href', '/e/private-sample');
  await expect(page.locator('.event-card').nth(1).locator('a')).toHaveAttribute('href', '/e/find-your-photos');
  await expect(page.locator('.event-card--protected')).toHaveCount(1);
  const protectedCard = page.locator('.event-card--protected');
  await expect(protectedCard.getByRole('heading', { name: 'A family afternoon' })).toBeVisible();
  await expect(protectedCard.getByText('An afternoon worth keeping.')).toBeVisible();
  await expect(protectedCard.locator('.progressive-photo__preview')).toHaveAttribute('src', '/brand/responsive/private-gallery-cover-320.webp');
  expect(await protectedCard.locator('img').evaluateAll((images) => images.every((image) => !image.getAttribute('src')?.startsWith('/media/')))).toBe(true);
  await expect(protectedCard.locator('a')).toHaveAttribute('href', '/e/private-sample');
  const arrowBottomGaps = await page.locator('.event-card').evaluateAll((cards) => cards.map((card) => {
    const arrow = card.querySelector('.event-card__arrow');
    return arrow ? card.getBoundingClientRect().bottom - arrow.getBoundingClientRect().bottom : -1;
  }));
  expect(Math.max(...arrowBottomGaps) - Math.min(...arrowBottomGaps)).toBeLessThan(2);
  await assertNoHorizontalOverflow(page);
  await protectedCard.locator('a').click();
  await expect(page.getByRole('heading', { level: 1, name: 'A family afternoon' })).toBeVisible();
  await expect(page.getByText('An afternoon worth keeping.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /gallery password|mot de passe de la galerie/i })).toBeVisible();
});
