import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.skip(process.env.CADRORA_SITE !== 'atelier-giulia', 'Atelier immersive presentation.');

const settings = {
  siteName: 'Atelier Giulia', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['family', 'wedding'], analyticsMeasurementId: null, themeMode: 'light',
  constructionNoticeEnabled: true, sessionsPageEnabled: true,
  homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-19T00:00:00.000Z',
};
const sessions = ['family', 'wedding'].map((id, sortOrder) => ({
  id, sortOrder, isBuiltin: true, enabled: true, showOnHome: true, imageRevision: null, imageSources: [],
  copy: {
    fr: { title: 'Vos moments en famille', shortDescription: 'Une séance pour raconter votre histoire.', description: 'Ensemble, créons vos souvenirs.', points: [] },
    en: { title: 'Your family moments', shortDescription: 'A session to tell your story.', description: 'Let’s make memories together.', points: [] },
  },
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: settings }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: sessions }));
});

for (const language of ['fr', 'en']) {
  test(`${language}: header compacts on slide navigation and document scroll, then expands at the top`, async ({ page }, testInfo) => {
    await page.goto(`/${language}/`);
    await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
    await expect(page.locator('.site-startup--overlay')).toHaveCount(0);
    const consent = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
    if (await consent.isVisible()) await consent.click();
    const header = page.locator('.public-header');
    const initial = (await header.boundingBox())!.height;
    const initialFont = await page.locator('.public-brand').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const dots = page.locator('.vertical-story-slider__pagination button');
    await dots.nth(1).click();
    await expect.poll(async () => (await header.boundingBox())!.height).toBeLessThan(initial);
    await expect.poll(() => page.locator('.public-brand').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeLessThan(initialFont);
    await expect(page.locator('.public-footer')).toBeVisible();
    await expect.poll(() => page.locator('.swiper-wrapper').evaluate((element) => element.getAnimations().some((animation) => animation.playState === 'running'))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`${language}-compact.png`), scale: 'css' });
    await dots.first().click();
    await expect.poll(async () => (await header.boundingBox())!.height).toBeCloseTo(initial, 0);
    await page.goto(`/${language}/privacy`);
    await page.mouse.wheel(0, 500);
    await expect(page.locator('.public-shell')).toHaveClass(/compact-header/u);
    await expect.poll(async () => (await header.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => (await header.boundingBox())!.y).toBeLessThan(80);
    await page.keyboard.press('Control+Home');
    await expect(page.locator('.public-shell')).not.toHaveClass(/compact-header/u);
    if (testInfo.project.name === 'mobile-chromium') {
      await expect.poll(async () => (await page.locator('.public-header__menu').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.locator('.public-header__menu').click();
      await expect(page.locator('#public-navigation')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.public-header__menu')).toBeFocused();
    }
    await assertNoHorizontalOverflow(page);
  });

  test(`${language}: landscape keeps the first title and CTA below the masthead`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`/${language}/`);
    await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
    await expect(page.locator('.site-startup--overlay')).toHaveCount(0);
    const consent = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
    if (await consent.isVisible()) await consent.click();
    const header = (await page.locator('.public-masthead').boundingBox())!;
    const title = (await page.locator('.swiper-slide-active h1').boundingBox())!;
    const cta = (await page.locator('.swiper-slide-active .session-story__cta').boundingBox())!;
    expect(title.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(cta.y + cta.height).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath(`${language}-landscape.png`), scale: 'css' });
    await page.locator('.swiper-slide-active .session-story__cta').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await assertNoHorizontalOverflow(page);
  });
}

test('long text scrolls before the next slide and remains reachable with enlarged type', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: sessions.map((session) => ({
    ...session, copy: { ...session.copy, fr: { ...session.copy.fr, shortDescription: 'Votre famille, vos liens et les petits moments du quotidien. '.repeat(3) } },
  })) }));
  await page.goto('/fr/');
  await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
  const consent = page.getByRole('button', { name: /nécessaire seulement/i });
  if (await consent.isVisible()) await consent.click();
  await page.addStyleTag({ content: 'html { font-size: 24px; }' });
  const area = page.locator('.swiper-slide-active [data-story-scroll]');
  await expect(area).toHaveAttribute('tabindex', '0');
  if (testInfo.project.name === 'mobile-chromium') {
    const touch = await page.context().newCDPSession(page);
    const box = (await area.boundingBox())!;
    const x = box.x + box.width / 2;
    const start = box.y + box.height - 10;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let step = 1; step <= 8; step++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start - step * (box.height - 20) / 8 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => area.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    await touch.detach();
  }
  await area.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => area.evaluate((e) => e.scrollTop)).toBe(0);
  await area.hover();
  await page.mouse.wheel(0, 60);
  await expect.poll(() => area.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('.vertical-story-slider__pagination button').first()).toHaveAttribute('aria-current', 'step');
  await page.keyboard.press('Home');
  await expect.poll(() => area.evaluate((e) => e.scrollTop)).toBe(0);
  await page.keyboard.press('PageDown');
  await expect.poll(() => area.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('.vertical-story-slider__pagination button').first()).toHaveAttribute('aria-current', 'step');
  await page.locator('.swiper-slide-active .session-story__cta').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a stalled local font does not hold the first frame indefinitely', async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  await page.addInitScript(() => { document.fonts.load = () => new Promise(() => {}); });
  await page.goto('/fr/');
  await expect(page.locator('.session-home__stage--pending')).toBeAttached();
  await expect(page.locator('.swiper-slide-active .progressive-photo--ready')).toBeAttached();
  await page.clock.runFor(4_000);
  await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vos moments en famille');
});

test('a stalled owner photo offers recovery on desktop and phone without requesting a default', async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: sessions.map((card) => ({
    ...card, imageRevision: 1, imageSources: [
      { url: `/service-media/${card.id}/1/preview`, width: 320, height: 213 },
      { url: `/service-media/${card.id}/1/large`, width: 1280, height: 853 },
    ],
  })) }));
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const defaults: string[] = [];
  page.on('request', (request) => {
    if (/\/brand\/(?:responsive\/)?service-/u.test(request.url())) defaults.push(request.url());
  });
  await page.route('**/service-media/**', async (route) => {
    await held;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853"><rect width="1280" height="853" fill="#777"/></svg>' }).catch(() => undefined);
  });
  try {
    await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.swiper-slide-active .progressive-photo img').first()).toBeAttached();
    await page.clock.runFor(31_000);
    await expect(page.getByRole('alert')).toContainText('Réessayer');
    expect(defaults).toEqual([]);
    await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
    release();
    await expect(page.locator('.swiper-slide-active .progressive-photo--ready')).toBeAttached();
    await page.clock.runFor(1_000);
    await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { release(); }
});

test('a stalled slider offers retry without exposing provisional content', async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(0);
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const bundle = /\/(?:src\/app\/components\/VerticalStorySlider\.tsx|assets\/VerticalStorySlider-[^/]+\.js)(?:\?|$)/u;
  await page.route(bundle, async (route) => {
    await held;
    await route.abort().catch(() => undefined);
  });
  try {
    await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.site-startup--overlay')).toBeVisible();
    await page.clock.fastForward(29_000);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.clock.fastForward(2_000);
    await expect(page.getByRole('alert')).toContainText('Réessayer');
    await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
    await page.unroute(bundle);
    release();
    await page.getByRole('link', { name: 'Réessayer' }).click();
    await page.clock.runFor(2_000);
    await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
  } finally { release(); }
});
