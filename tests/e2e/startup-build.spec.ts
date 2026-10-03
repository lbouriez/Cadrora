import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resolve } from 'node:path';

import { assertNoHorizontalOverflow } from './fixtures';

// The localized HTML is generated after Vite builds; a dev-server test cannot
// catch the raw SEO fallback or the missing pre-JavaScript profile attribute.
test.skip(process.env.CADRORA_E2E_BUILD !== 'true', 'Requires npm run build and CADRORA_E2E_BUILD=true.');

const siteId = process.env.CADRORA_SITE || 'cadrora';
const atelier = siteId === 'atelier-giulia';

interface StartupFrame { photoId: number; displayDecoded: boolean; titleOpacity: string; dots: number }
declare global { interface Window { startupFrames: StartupFrame[] } }

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
