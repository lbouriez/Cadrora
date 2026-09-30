import type { Page } from '@playwright/test';
import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.skip(process.env.CADRORA_SITE !== 'atelier-giulia', 'Run with CADRORA_SITE=atelier-giulia.');

function sessionCard(id: string, fr: string, en: string, sortOrder: number, showOnHome = true) {
  return {
    id, isBuiltin: true, sortOrder, enabled: true, showOnHome,
    copy: {
      fr: { title: fr, shortDescription: `Séance ${fr}`, description: `Photographier ${fr}`, points: [] },
      en: { title: en, shortDescription: `${en} session`, description: `Photograph ${en}`, points: [] },
    },
    imageRevision: null, imageSources: [],
  };
}

async function dismissConsent(page: Page) {
  const necessary = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
  if (await necessary.isVisible()) await necessary.click();
}

async function openMenuForHiddenLanguage(page: Page) {
  if (await page.locator('.public-header__language').isHidden()) await page.locator('.public-header__menu').click();
}

test('the built-in Family session has its own cover when the catalog is unavailable', async ({ page }) => {
  await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/services');

  const family = page.locator('.service-detail-card').filter({ has: page.getByRole('heading', { name: 'Famille', exact: true }) });
  await expect(family).toHaveCount(1);
  const preview = family.locator('.progressive-photo__preview');
  await expect(preview).toHaveAttribute('src', '/brand/responsive/service-family-320.webp');
  await family.scrollIntoViewIfNeeded();
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('Atelier Giulia inherits the shared site without demo journeys or invented contact details', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }) }));
  await page.goto('/');

  await expect(page).toHaveTitle('Atelier Giulia');
  await expect(page.locator('html')).toHaveAttribute('data-site', 'atelier-giulia');
  await expect(page.locator('.session-story')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/mariages|weddings/i);
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
  await expect(page.locator('.service-detail-card')).toHaveCount(8);
  await expect(page.locator('.service-detail-card h2')).toContainText([
    'Mariages et événements', 'Famille', 'Photos pour votre marque', 'Photos d’entreprise',
    'Portraits d’enfants', 'Maternité', 'Portraits', 'Couples',
  ]);
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
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rencontrez Giulia');
  await expect(page.getByText('Derrière l’objectif')).toHaveCount(0);
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
    constructionNoticeEnabled: true,
    homeGalleries: { enabled: true, limit: 6 }, updatedAt: '2026-09-26T12:00:00.000Z',
  }) }));
  await page.route(/\/api\/v1\/galleries(?:\?.*)?$/u, (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events: [], protectedGalleries: [], nextCursor: null }),
  }));
  await page.goto('/');
  await dismissConsent(page);
  await expect(page).toHaveTitle('Studio Boréal');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Portraits du Québec.');
  await expect(page.locator('.public-footer')).toContainText('© Studio Boréal · Des histoires à garder.');
  await expect(page.locator('.public-footer__credit')).toHaveText('par Cadrora');
  await expect(page.locator('.public-construction-notice')).toHaveText('Notre site est en préparation. Merci de votre patience.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mariages');

  await openMenuForHiddenLanguage(page);
  await page.locator('.public-header__language').click();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Portraits from Québec.');
  await expect(page.locator('.public-footer')).toContainText('© Studio Boréal · Stories to keep.');
  await expect(page.locator('.public-footer__credit')).toHaveText('by Cadrora');
  await expect(page.locator('.public-construction-notice')).toHaveText('Our site is in progress. Thank you for your patience.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Weddings');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
});

test('the shared masthead and page introductions align across routes', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    constructionNoticeEnabled: true, homeGalleries: { enabled: false, limit: 6 },
    updatedAt: '2026-09-27T00:00:00.000Z',
  }) }));
  const positions = [];
  for (const path of ['/', '/services', '/contact', '/portfolio']) {
    await page.goto(path);
    await expect(page.locator('.public-construction-notice')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (path !== '/') await expect(page.locator('.public-page-intro')).toHaveCSS('transform', 'none');
    positions.push(await page.evaluate(() => {
      const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top;
      return { brand: top('.public-brand'), menu: top('.public-header__actions'),
        intro: top('.public-page-intro .site-eyebrow') };
    }));
  }
  for (const position of positions.slice(1)) {
    expect(position.brand).toBeCloseTo(positions[0]?.brand ?? NaN, 0);
    expect(position.menu).toBeCloseTo(positions[0]?.menu ?? NaN, 0);
  }
  expect(positions[1]?.intro).toBeCloseTo(positions[2]?.intro ?? NaN, 0);
  expect(positions[1]?.intro).toBeCloseTo(positions[3]?.intro ?? NaN, 0);
  await page.setViewportSize({ width: 320, height: 700 });
  const narrowPositions = [];
  for (const path of ['/', '/services']) {
    await page.goto(path);
    await expect(page.locator('.public-construction-notice')).toBeVisible();
    narrowPositions.push(await page.locator('.public-brand').boundingBox());
  }
  expect(narrowPositions[0]?.y).toBeCloseTo(narrowPositions[1]?.y ?? NaN, 0);
});

test('owner sessions form full-height panels with their own booking action', async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: false, limit: 6 },
    updatedAt: '2026-09-27T00:00:00.000Z',
  }) }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    sessionCard('wedding', 'Mariages', 'Weddings', 0),
    sessionCard('family', 'Familles', 'Families', 1),
    sessionCard('brand', 'Portraits', 'Portraits', 2),
  ]) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mariages');
  const panels = page.locator('.session-story__panel');
  await expect(panels).toHaveCount(3);
  const hero = await panels.first().boundingBox();
  expect(hero?.y).toBe(0);
  expect(hero?.height).toBe(page.viewportSize()?.height);
  expect((await page.locator('.public-shell--immersive .public-header').boundingBox())?.y).toBe(0);
  await expect(page.locator('.session-story__cta')).toHaveCount(3);
  await expect(page.locator('.session-story__cta').first()).toHaveAttribute('href', '/contact');
  await expect(page.locator('.session-story__panel').nth(1).getByRole('heading', { level: 2 })).toHaveText('Familles');
  await expect(page.locator('.session-story__panel').nth(2).getByRole('heading', { level: 2 })).toHaveText('Portraits');
  await expect(page.locator('.session-story__arrow')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test('even strong wheel or finger gestures settle on exactly one session', async ({ page }, testInfo) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding', 'family', 'brand'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: false, limit: 6 },
    updatedAt: '2026-09-29T00:00:00.000Z',
  }) }));
  let releaseServices = () => {};
  const servicesReady = new Promise<void>((resolve) => { releaseServices = () => resolve(); });
  await page.route('**/api/v1/services', async (route) => {
    await servicesReady;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([
      sessionCard('children', 'Enfants', 'Children', 0),
      sessionCard('corporate', 'Entreprises', 'Corporate', 1),
      sessionCard('family', 'Familles', 'Families', 2),
    ]) });
  });
  await page.goto('/');
  await dismissConsent(page);
  await expect(page.locator('.session-story__panel')).toHaveCount(3);
  await page.waitForTimeout(100);
  releaseServices();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Enfants');
  const footer = page.locator('.public-footer');
  await expect(footer).toBeHidden();
  await expect(footer).toHaveAttribute('inert', '');
  const viewport = page.viewportSize();
  const height = viewport?.height ?? 844;
  const gesture = async (direction: 1 | -1) => {
    if (testInfo.project.name === 'mobile-chromium') {
      const session = await page.context().newCDPSession(page);
      const x = (viewport?.width ?? 390) / 2;
      const startY = direction > 0 ? height * 0.82 : height * 0.18;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, id: 0 }] });
      for (let step = 1; step <= 5; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x, y: startY - direction * height * 0.7 * step / 5, id: 0 }],
        });
        await page.waitForTimeout(12);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move((viewport?.width ?? 1_440) / 2, height / 2);
      await page.mouse.wheel(0, direction * height * 3);
      for (let pulse = 0; pulse < 3; pulse += 1) {
        await page.mouse.wheel(0, direction * 150);
        await page.waitForTimeout(40);
      }
    }
    await page.waitForTimeout(1_300);
  };
  const settledAt = async (index: number) => {
    await expect(page.locator('.session-story__panel').nth(index)).toHaveClass(/swiper-slide-active/u);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  };
  await gesture(1);
  await settledAt(1);
  await expect(page.locator('.session-story__panel').nth(1).locator('.session-story__content'))
    .toHaveClass(/motion-reveal--visible/u);
  await gesture(1);
  await settledAt(2);
  await expect(footer).toBeVisible();
  await expect(footer).not.toHaveAttribute('inert');
  await gesture(-1);
  await settledAt(1);
  await expect(footer).toBeHidden();
  await gesture(1);
  await settledAt(2);
  await gesture(1);
  await settledAt(2);
  await expect(footer).toBeVisible();
  await expect(footer).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 390, height: 600 });
    const footerBox = await footer.boundingBox();
    const bookingBox = await page.locator('.swiper-slide-active .session-story__cta').boundingBox();
    expect(footerBox && bookingBox ? footerBox.y - bookingBox.y - bookingBox.height : 0).toBeGreaterThan(16);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  }
});

test('Atelier keeps the reference slide animation for wheel and touch in a reduced-motion browser', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    sessionCard('wedding', 'Mariages', 'Weddings', 0),
    sessionCard('family', 'Familles', 'Families', 1),
    sessionCard('brand', 'Portraits', 'Portraits', 2),
  ]) }));
  await page.goto('/');
  await dismissConsent(page);
  await expect(page.locator('.session-story__panel')).toHaveCount(3);
  const viewport = page.viewportSize();
  const height = viewport?.height ?? 844;
  if (testInfo.project.name === 'mobile-chromium') {
    const session = await page.context().newCDPSession(page);
    const x = (viewport?.width ?? 390) / 2;
    const startY = height * 0.82;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, id: 0 }] });
    for (let step = 1; step <= 5; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x, y: startY - height * 0.5 * step / 5, id: 0 }],
      });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move((viewport?.width ?? 1_440) / 2, height / 2);
    await page.mouse.wheel(0, 120);
  }
  await expect(page.locator('.session-story__panel').nth(1)).toHaveClass(/swiper-slide-active/u);
  const wrapper = page.locator('.vertical-story-slider .swiper-wrapper');
  await expect.poll(() => wrapper.evaluate((element) => (element as HTMLElement).style.transitionDuration)).toBe('1200ms');
  const firstFrame = await wrapper.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(250);
  const middleFrame = await wrapper.evaluate((element) => getComputedStyle(element).transform);
  expect(middleFrame).not.toBe(firstFrame);
  if (testInfo.project.name === 'desktop-chromium') {
    await page.waitForTimeout(1_000);
    await page.locator('.vertical-story-slider').focus();
    await page.keyboard.press('PageDown');
    await expect(page.locator('.session-story__panel').nth(2)).toHaveClass(/swiper-slide-active/u);
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('Atelier mobile menu covers the photo and returns to the ivory interior header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/site', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await dismissConsent(page);
  const menu = page.locator('.public-header__menu');
  await expect(page.locator('.public-brand span')).toBeVisible();
  await expect(page.locator('.public-header__language')).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.public-nav')).toBeVisible();
  await expect(page.locator('.public-header__language')).toBeVisible();
  expect(await page.locator('.public-nav').boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  expect(await page.locator('main').evaluate((main) => (main as HTMLElement).inert)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('main').evaluate((main) => (main as HTMLElement).inert)).toBe(false);
  await menu.click();
  await page.getByRole('navigation', { name: /navigation principale|primary navigation/i }).getByRole('link', { name: /séances|sessions/i }).click();
  await expect(page).toHaveURL(/\/services$/u);
  await expect(page.locator('.public-shell--immersive')).toHaveCount(0);
  expect(await page.locator('.public-header').evaluate((header) => {
    const sample = document.createElement('div');
    sample.style.backgroundColor = 'var(--color-background)';
    document.body.append(sample);
    const expected = getComputedStyle(sample).backgroundColor;
    sample.remove();
    return getComputedStyle(header).backgroundColor === expected;
  })).toBe(true);
  await assertNoHorizontalOverflow(page);
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

test('Home obeys session eligibility while the Sessions page stays complete', async ({ page }) => {
  const sessions = [
    sessionCard('wedding', 'Mariages', 'Weddings', 0),
    sessionCard('family', 'Familles', 'Families', 1),
    sessionCard('brand', 'Portraits', 'Portraits', 2),
    sessionCard('children', 'Enfants', 'Children', 3, false),
  ];
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: true, limit: 2 }, updatedAt: '2026-09-26T12:00:00.000Z',
  }) }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) }));

  await page.goto('/');
  await expect(page.locator('#galleries')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mariages');
  await expect(page.locator('.session-story__panel')).toHaveCount(3);
  await expect(page.locator('.session-story__panel').nth(1).getByRole('heading', { level: 2 })).toHaveText('Familles');
  await expect(page.locator('.session-story__panel').nth(2).getByRole('heading', { level: 2 })).toHaveText('Portraits');
  await page.goto('/services');
  await expect(page.locator('.service-detail-card')).toHaveCount(4);
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
    homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-09-26T12:00:00.000Z',
  }) }));
  await page.goto('/');
  await dismissConsent(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await openMenuForHiddenLanguage(page);
  await page.locator('.public-header__language').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
