import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resolve } from 'node:path';

import { assertNoHorizontalOverflow } from './fixtures';

// The localized HTML is generated after Vite builds; a dev-server test cannot
// catch the raw SEO fallback or the missing pre-JavaScript profile attribute.
test.skip(process.env.CADRORA_E2E_BUILD !== 'true', 'Requires npm run build and CADRORA_E2E_BUILD=true.');

const siteId = process.env.CADRORA_SITE || 'cadrora';
const atelier = siteId === 'atelier-giulia';

test('unknown documents are real localized 404s and marketing stays static', async ({ request }) => {
  for (const language of ['fr', 'en']) {
    const missing = await request.get(`/${language}/does-not-exist/`);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain('name="robots" content="noindex,nofollow"');
    expect(await missing.text()).toContain(`<html lang="${language}"`);
    const home = await request.get(`/${language}/`);
    expect(home.status()).toBe(200);
    expect(home.headers()['cache-control']).toContain('no-transform');
    const contact = await request.get(`/${language}/contact/`);
    expect(contact.status()).toBe(200);
    expect(contact.headers()['cache-control']).toContain('no-transform');
  }
  const directory = await request.get('/galleries');
  expect(directory.status()).toBe(200);
  expect(await directory.text()).toContain('name="robots" content="noindex,nofollow"');
});

test('Cadrora resolves the optional demo before exposing the sections below it', async ({ page }) => {
  test.skip(atelier, 'Cadrora optional showcase section.');
  await installOwnerHome(page);
  let release = () => {};
  const settings = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v1/site', async (route) => {
    await settings;
    await route.fulfill({ json: {
      siteName: 'Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['wedding', 'family'], analyticsMeasurementId: null, themeMode: 'light',
      galleryDirectoryEnabled: true, homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-03T00:00:00.000Z',
    } });
  });
  try {
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.site-startup')).toBeVisible();
    await expect(page.locator('#stack-title')).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator('#stack-title')).toBeAttached();
  await expect(page.locator('#demo-title')).toBeAttached();
  await expect(page.locator('.site-startup')).toHaveCount(0);
  await expect(page.locator('.public-brand')).toHaveAccessibleName('Cadrora — Home');
});

interface StartupFrame { photoId: number; displayDecoded: boolean; titleOpacity: string; dots: number }
interface AboutFrame { photoId: number; displayDecoded: boolean; titleVisible: boolean; opacity: number }
interface CrossfadeFrame { stageOpacity: number; overlayOpacity: number | null }
declare global { interface Window { startupFrames: StartupFrame[]; aboutFrames: AboutFrame[]; crossfadeFrames: CrossfadeFrame[] } }

async function observeCrossfade(page: Page) {
  await page.addInitScript(() => {
    window.crossfadeFrames = [];
    const sample = () => {
      const stage = document.querySelector('.session-home__stage');
      const overlay = document.querySelector('.site-startup--overlay');
      const stageOpacity = stage ? Number(getComputedStyle(stage).opacity) : 0;
      if (stageOpacity > 0) window.crossfadeFrames.push({
        stageOpacity,
        overlayOpacity: overlay ? Number(getComputedStyle(overlay).opacity) : null,
      });
      if (window.crossfadeFrames.length < 90) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function expectContinuousCrossfade(page: Page) {
  await expect.poll(() => page.evaluate(() => window.crossfadeFrames.length)).toBeGreaterThanOrEqual(12);
  const frames = await page.evaluate(() => window.crossfadeFrames);
  expect(frames.some((frame) => frame.stageOpacity > 0.1 && frame.stageOpacity < 0.9
    && frame.overlayOpacity !== null && frame.overlayOpacity > 0.1 && frame.overlayOpacity < 0.9)).toBe(true);
  expect(frames.every((frame) => frame.stageOpacity > 0.99 || frame.overlayOpacity !== null && frame.overlayOpacity > 0)).toBe(true);
}

test.describe('Cadrora first frame', () => {
  test.skip(atelier, 'Standard Home presentation.');

  test('loads lower gallery covers only when the visitor approaches them', async ({ page }) => {
    await installOwnerHome(page);
    await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
      siteName: 'Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
      galleryDirectoryEnabled: true, homeGalleries: { enabled: true, limit: 6 },
      updatedAt: '2026-10-03T00:00:00.000Z',
    } }));
    await page.route('**/api/v1/galleries?**', (route) => route.fulfill({ json: {
      events: [{ id: 'test-gallery', slug: 'test-gallery', title: 'Gallery', description: null,
        service: null, startsAt: '2026-09-26T12:00:00.000Z', timezone: 'America/Toronto',
        coverPhotoId: 'test-photo', coverPhotoUrl: '/media/test-gallery/test-photo/1/medium',
        visibility: 'published', access: 'public', allowDownloads: false, faceSearchEnabled: false,
        nearbySearchEnabled: false, showPhotoMetadata: false, retouchSelectionEnabled: false,
        retentionDays: null, revision: 1, createdAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' }],
      protectedGalleries: [], nextCursor: null,
    } }));
    const requests: string[] = [];
    await page.route('**/media/test-gallery/**', async (route) => {
      requests.push(route.request().url());
      await route.fulfill({ path: resolve('public/brand/demo-hero.webp'), contentType: 'image/webp' });
    });
    await page.goto('/fr/');
    await expect(page.locator('.site-startup')).toHaveCount(0);
    const cover = page.locator('#galleries .event-card .progressive-photo');
    await expect(cover).toBeAttached();
    expect(requests).toEqual([]);
    await expect(cover.locator('img')).toHaveCount(0);
    await cover.scrollIntoViewIfNeeded();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect(cover.locator('.progressive-photo__optimized')).toHaveJSProperty('complete', true);
    await expect(cover).toHaveClass(/progressive-photo--ready/u);
  });

  for (const language of ['fr', 'en']) {
    test(`${language} keeps the identity until the owner display photo is ready`, async ({ page }, testInfo) => {
      await installOwnerHome(page);
      await observeCrossfade(page);
      await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
        siteName: 'Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
        contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
        map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
        enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'light',
        homeHeroImageRevision: 2, homeGalleries: { enabled: false, limit: 6 },
        updatedAt: '2026-10-03T00:00:00.000Z',
      } }));
      const fallbackRequests: string[] = [];
      page.on('request', (request) => { if (request.url().includes('/home-hero-image/')) fallbackRequests.push(request.url()); });
      let release = () => {};
      const waiting = new Promise<void>((resolve) => { release = resolve; });
      let requested = false;
      await page.route(/\/service-media\/home-hero\/2\/(?:small|medium|large)$/u, async (route) => {
        requested = true;
        await waiting;
        await route.fallback();
      });
      try {
        await page.goto(`/${language}/`, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => requested).toBe(true);
        await expect(page.locator('.site-startup__brand')).toHaveText('Cadrora');
        await expect(page.locator('.site-startup__brand')).toBeInViewport();
        await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '0');
        await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('waiting-for-display-photo.png') });
      } finally { release(); }
      await expect(page.locator('.site-startup')).toHaveCount(0);
      await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
      await expectContinuousCrossfade(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.site-hero__art > .progressive-photo .progressive-photo__optimized')).toHaveJSProperty('complete', true);
      expect(fallbackRequests).toEqual([]);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('complete-first-frame.png') });
      await page.locator('.site-hero__copy a').first().focus();
      await expect(page.locator('.site-hero__copy a').first()).toBeFocused();
    });
  }

  for (const failure of ['display', 'all']) {
    test(`recovers when ${failure} hero sources fail`, async ({ page }) => {
      await installOwnerHome(page);
      await page.route('**/home-hero-image/**', async (route) => {
        if (failure === 'display' && route.request().url().endsWith('/preview')) {
          await route.fulfill({ path: resolve('public/brand/demo-hero.webp'), contentType: 'image/webp' });
        } else await route.abort();
      });
      await page.goto('/fr/');
      await expect(page.locator('.site-startup')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
    });
  }
});

async function installOwnerHome(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
    siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding', 'family'], analyticsMeasurementId: null, themeMode: 'light',
    homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-03T00:00:00.000Z',
  } }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: ['wedding', 'family'].map((id, index) => ({
    id, isBuiltin: true, sortOrder: index, enabled: true, showOnHome: true, imageRevision: 1,
    copy: {
      fr: { title: index ? 'Familles' : 'Mariages', shortDescription: 'Des instants à partager.', description: 'Photographie', points: [] },
      en: { title: index ? 'Families' : 'Weddings', shortDescription: 'Moments to share.', description: 'Photography', points: [] },
    },
    imageSources: [{ url: `/service-media/${id}/1/preview`, width: 320, height: 213 },
      { url: `/service-media/${id}/1/large`, width: 1280, height: 853 }],
  })) }));
  await page.route('**/service-media/**', (route) => route.fulfill({ path: resolve('public/brand/demo-hero.webp'), contentType: 'image/webp' }));
}

test.describe('immersive first frame', () => {
  test.skip(!atelier, 'The Atelier profile uses the immersive slider.');

  for (const language of ['fr', 'en']) {
    for (const resource of ['slider-js', 'slider-css', 'settings', 'display-photo', 'font']) {
      test(`${language} reveals one complete frame with slow ${resource}`, async ({ page }, testInfo) => {
        await installOwnerHome(page);
        if (resource === 'display-photo') await observeCrossfade(page);
        await page.addInitScript(() => {
          window.startupFrames = [];
          const photos = new WeakMap<Element, number>();
          let nextId = 0;
          const sample = () => {
            const stage = document.querySelector('.session-home__stage');
            const photo = document.querySelector<HTMLImageElement>('.session-story__photo .progressive-photo__optimized');
            const title = document.querySelector('.session-story__content');
            if (photo && !photos.has(photo)) photos.set(photo, ++nextId);
            if (stage && Number(getComputedStyle(stage).opacity) > 0) window.startupFrames.push({
              photoId: photo ? photos.get(photo) ?? 0 : 0,
              displayDecoded: Boolean(photo?.complete && photo.naturalWidth),
              titleOpacity: title ? getComputedStyle(title).opacity : '0',
              dots: document.querySelectorAll('.vertical-story-slider__page').length,
            });
            if (window.startupFrames.length < 180) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        const pattern = resource === 'slider-js' ? /\/assets\/VerticalStorySlider-.*\.js$/u
          : resource === 'slider-css' ? /\/assets\/VerticalStorySlider-.*\.css$/u
            : resource === 'settings' ? '**/api/v1/site'
              : resource === 'font' ? '**/*.woff2' : '**/service-media/wedding/1/large';
        let requested = false;
        let release = () => {};
        const waiting = new Promise<void>((resolve) => { release = resolve; });
        await page.route(pattern, async (route) => { requested = true; await waiting; await route.fallback(); });
        try {
          await page.goto(`/${language}/`, { waitUntil: 'commit' });
          await expect.poll(() => requested).toBe(true);
          await expect(page.locator('.site-startup--overlay')).toBeVisible();
          await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '0');
          await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
          if (resource.startsWith('slider')) await expect(page.locator('.session-story__photo')).toHaveCount(0);
          await expect.poll(() => page.evaluate(() => window.startupFrames.length)).toBe(0);
        } finally { release(); }
        await expect(page.locator('.site-startup')).toHaveCount(0);
        await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
        if (resource === 'display-photo') await expectContinuousCrossfade(page);
        await expect.poll(() => page.evaluate(() => window.startupFrames.length)).toBeGreaterThanOrEqual(12);
        const frames = await page.evaluate(() => window.startupFrames);
        expect(new Set(frames.map((frame) => frame.photoId)).size).toBe(1);
        expect(frames.every((frame) => frame.photoId > 0 && frame.displayDecoded && frame.titleOpacity === '1' && frame.dots === 2)).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(language === 'fr' ? 'Mariages' : 'Weddings');
        await assertNoHorizontalOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('complete-first-frame.png') });
        const next = page.locator('.vertical-story-slider__page').nth(1);
        await next.click();
        await expect(next).toHaveAttribute('aria-current', 'step');
      });
    }
  }

  for (const failure of ['display-photo', 'all-photos', 'slider']) {
    test(`recovers from failed ${failure}`, async ({ page }) => {
      await installOwnerHome(page);
      const pattern = failure === 'slider' ? /\/assets\/VerticalStorySlider-.*\.js$/u
        : failure === 'all-photos' ? '**/service-media/**' : '**/service-media/*/1/large';
      await page.route(pattern, (route) => route.abort());
      await page.goto('/en/');
      if (failure === 'slider') {
        await expect(page.getByRole('alert')).toContainText('Loading was interrupted.');
        await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
        await page.locator('.site-startup summary').click();
        await page.locator('.site-startup').getByRole('link', { name: 'Contact' }).click();
        await expect(page).toHaveURL(/\/en\/contact$/u);
        await expect(page.locator('.site-startup')).toHaveCount(0);
      } else {
        await expect(page.locator('.site-startup')).toHaveCount(0);
        await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Weddings');
        await expect(page.locator('.vertical-story-slider__page')).toHaveCount(2);
      }
    });
  }
});

test.describe('immersive About first frame', () => {
  test.skip(!atelier, 'The Atelier profile has the immersive About page.');

  for (const language of ['fr', 'en']) {
    test(`${language} reveals the complete About photo and title together`, async ({ page }, testInfo) => {
      await observeCrossfade(page);
      await page.addInitScript(() => {
        localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
        window.aboutFrames = [];
        const photos = new WeakMap<Element, number>();
        let nextId = 0;
        const sample = () => {
          const stage = document.querySelector('.session-home__stage');
          const photo = document.querySelector<HTMLImageElement>('.about-page__image .progressive-photo__optimized');
          const title = document.querySelector('.about-page__hero-copy h1');
          if (photo && !photos.has(photo)) photos.set(photo, ++nextId);
          const opacity = stage ? Number(getComputedStyle(stage).opacity) : 0;
          if (opacity > 0) window.aboutFrames.push({
            photoId: photo ? photos.get(photo) ?? 0 : 0,
            displayDecoded: Boolean(photo?.complete && photo.naturalWidth),
            titleVisible: Boolean(title && getComputedStyle(title).visibility === 'visible'),
            opacity,
          });
          if (window.aboutFrames.length < 120) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
        siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
        contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
        map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
        enabledServices: ['family'], analyticsMeasurementId: null, themeMode: 'light',
        homeGalleries: { enabled: false, limit: 6 }, aboutEnabled: true, aboutImageRevision: 2,
        aboutImageMediumWidth: 1280, aboutImageLargeWidth: 2560, updatedAt: '2026-10-04T00:00:00.000Z',
      } }));
      let release = () => {};
      const waiting = new Promise<void>((resolve) => { release = resolve; });
      let requested = false;
      const fallbackRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/about-hero-image/')) fallbackRequests.push(request.url());
      });
      await page.route('**/service-media/about-hero/2/**', async (route) => {
        requested = true;
        await waiting;
        await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1706"><rect width="2560" height="1706" fill="#777"/></svg>' });
      });
      try {
        await page.goto(`/${language}/about/`, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => requested).toBe(true);
        await expect(page.locator('.site-startup--overlay')).toBeVisible();
        await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '0');
        await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
        expect(await page.evaluate(() => window.aboutFrames)).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath('about-waiting-for-photo.png') });
      } finally { release(); }
      await expect(page.locator('.site-startup')).toHaveCount(0);
      await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
      await expectContinuousCrossfade(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.about-page__image .progressive-photo__optimized')).toHaveJSProperty('complete', true);
      await expect.poll(() => page.evaluate(() => window.aboutFrames.length)).toBeGreaterThanOrEqual(12);
      const frames = await page.evaluate(() => window.aboutFrames);
      expect(new Set(frames.map((frame) => frame.photoId))).toEqual(new Set([1]));
      expect(frames.every((frame) => frame.displayDecoded && frame.titleVisible)).toBe(true);
      expect(frames.some((frame) => frame.opacity > 0 && frame.opacity < 1)).toBe(true);
      expect(fallbackRequests).toEqual([]);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('about-complete-first-frame.png') });
    });
  }

  test('releases About when both photo sources fail', async ({ page }) => {
    await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
      siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['family'], analyticsMeasurementId: null, themeMode: 'light',
      homeGalleries: { enabled: false, limit: 6 }, aboutEnabled: true, updatedAt: '2026-10-04T00:00:00.000Z',
    } }));
    await page.route('**/about-hero-image/**', (route) => route.abort());
    await page.goto('/fr/about/');
    await expect(page.locator('.site-startup')).toHaveCount(0);
    await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

for (const language of ['fr', 'en']) {
  for (const path of ['', 'contact/']) {
    test(`${language}/${path} is branded before JavaScript and hands over to React`, async ({ page }, testInfo) => {
      let release = () => {};
      const scripts = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/assets/*.js', async (route) => { await scripts; await route.continue(); });
      await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      try {
        await page.goto(`/${language}/${path}`, { waitUntil: 'commit' });
        await expect(page.locator('.site-startup__brand')).toHaveText(atelier ? 'Atelier Giulia' : 'Cadrora');
        await expect(page.locator('html')).toHaveAttribute('data-site', siteId);
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.locator('.site-startup')).toHaveCSS('background-color', atelier ? 'rgb(246, 241, 231)' : 'rgb(255, 250, 247)');
        await expect(page.locator('.site-startup h1')).toBeHidden();
        await expect(page.locator('.public-header')).toHaveCount(0);
        await assertNoHorizontalOverflow(page);
        const bounds = await page.locator('.site-startup').boundingBox();
        expect(bounds?.height).toBe(page.viewportSize()?.height);
        await page.screenshot({ path: testInfo.outputPath('before-javascript.png') });
      } finally {
        release();
      }
      await expect(page.locator('.public-header')).toBeVisible();
      await expect(page.locator('.site-startup')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
      await assertNoHorizontalOverflow(page);
    });
  }

  test(`${language} fallback navigation works with JavaScript disabled`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
    const page = await context.newPage();
    try {
      await page.goto(`${String(testInfo.project.use.baseURL)}/${language}/`);
      await page.locator('.site-startup summary').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.site-startup h1')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('without-javascript.png'), fullPage: true });
      await page.locator(`.site-startup a[href="/${language}/contact/"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${language}/contact/?$`, 'u'));
      await page.locator('.site-startup summary').click();
      await expect(page.locator('.site-startup h1')).toContainText(/contact/i);
    } finally {
      await context.close();
    }
  });
}
