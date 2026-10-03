import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const siteSettings = {
  siteName: 'Photo studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['maternity'], homeGalleries: { enabled: false, limit: 6 },
  galleryDirectoryEnabled: false, analyticsMeasurementId: null, themeMode: 'light',
  updatedAt: '2026-09-30T00:00:00.000Z',
};

const ownerSession = {
  id: 'maternity', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
  copy: {
    fr: { title: 'Ma séance personnalisée', shortDescription: 'Mon histoire', description: 'Ma séance', points: [] },
    en: { title: 'My custom session', shortDescription: 'My story', description: 'My session', points: [] },
  },
  imageRevision: 1,
  imageSources: [
    { url: '/service-media/maternity/1/preview', width: 320, height: 320 },
    { url: '/service-media/maternity/1/large', width: 1280, height: 1280 },
  ],
};

for (const path of ['/', '/services']) {
  test(`${path} waits for owner photos without requesting default session images`, async ({ page }, testInfo) => {
    const immersive = path === '/' && process.env.CADRORA_SITE === 'atelier-giulia';
    if (immersive) await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
    const english = testInfo.project.name === 'mobile-chromium';
    if (english) await page.addInitScript(() => localStorage.setItem('cadrora-language', 'en'));
    const defaults: string[] = [];
    page.on('request', (request) => {
      if (/\/brand\/(?:responsive\/)?service-(?:maternity|portrait|couples)/u.test(request.url())) defaults.push(request.url());
    });
    let release = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(siteSettings) }));
    await page.route('**/api/v1/services', async (route) => {
      await pending;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([ownerSession]) });
    });
    await page.route('**/service-media/**', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280"><rect width="1280" height="1280" fill="#aaa"/></svg>',
    }));
    try {
      await page.goto(path);
      if (!immersive) await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
      await expect(immersive ? page.locator('.site-startup--overlay')
        : page.getByRole('status', { name: /chargement des séances|loading sessions/i })).toBeVisible();
      await page.locator('.site-startup--overlay, .service-grid, .service-detail-grid').scrollIntoViewIfNeeded();
      await expect(page.locator('.service-photo')).toHaveCount(0);
      expect(defaults).toEqual([]);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('catalog-pending.png') });
      release();
      await expect(page.locator('.service-photo img')).toHaveCount(2);
      for (const image of await page.locator('.service-photo img').all()) {
        await expect(image).toHaveAttribute('src', /^\/service-media\/maternity\/1\//u);
      }
      await expect(page.getByRole('heading', { name: english ? 'My custom session' : 'Ma séance personnalisée' })).toBeVisible();
      if (immersive) await expect(page.locator('.session-home__stage--pending')).toHaveCount(0);
      expect(defaults).toEqual([]);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('catalog-resolved.png') });
      if (path === '/') {
        await page.locator('.public-brand').focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();
      } else {
        await page.getByRole('button', { name: /plus d’infos|more information/i }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    } finally { release(); }
  });

  test(`${path} uses enabled defaults only after a failed catalog and pending settings settle`, async ({ page }) => {
    const immersive = path === '/' && process.env.CADRORA_SITE === 'atelier-giulia';
    let releaseSettings = () => {};
    const pendingSettings = new Promise<void>((resolve) => { releaseSettings = resolve; });
    await page.route('**/api/v1/site', async (route) => {
      await pendingSettings;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(siteSettings) });
    });
    await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    try {
      const failed = page.waitForResponse('**/api/v1/services');
      await page.goto(path);
      await failed;
      await expect(immersive ? page.locator('.site-startup--overlay')
        : page.getByRole('status', { name: /chargement des séances|loading sessions/i })).toBeVisible();
      await page.locator('.site-startup--overlay, .service-grid, .service-detail-grid').scrollIntoViewIfNeeded();
      await expect(page.locator('.service-photo')).toHaveCount(0);
      releaseSettings();
      await expect(page.locator('.service-photo')).toHaveCount(1);
      await expect(page.locator('.service-photo .progressive-photo__preview')).toHaveAttribute('src', '/brand/responsive/service-maternity-320.webp');
      await expect(page.getByRole('heading', { name: /maternité|maternity/i, exact: true })).toBeVisible();
    } finally { releaseSettings(); }
  });
}

for (const path of ['/', '/about']) {
  test(`${path} resolves site-photo overrides before the shared renderer requests an image`, async ({ page }, testInfo) => {
    test.skip(path === '/' && process.env.CADRORA_SITE === 'atelier-giulia', 'This Home profile uses session photos.');
    const owner = path === '/' ? 'home-hero' : 'about-hero';
    const frame = page.locator(path === '/' ? '.site-hero__art > .progressive-photo' : '.about-page__image');
    const requests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith(`/${owner}-image/`) || pathname.startsWith(`/service-media/${owner}/`)) requests.push(pathname);
    });
    let release = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/v1/site', async (route) => {
      await pending;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...siteSettings,
        homeHeroImageRevision: 2, homeHeroImageMediumWidth: 1280, homeHeroImageLargeWidth: 2560,
        aboutImageRevision: 2, aboutImageMediumWidth: 1280, aboutImageLargeWidth: 2560,
      }) });
    });
    await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.route('**/service-media/**', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1706"><rect width="2560" height="1706" fill="#aaa"/></svg>',
    }));
    try {
      await page.goto(path);
      await expect(frame).toBeVisible();
      await expect(frame.locator('img')).toHaveCount(0);
      expect(requests).toEqual([]);
      await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
      await page.screenshot({ path: testInfo.outputPath('site-photo-pending.png') });
      release();
      await expect(frame.locator('img')).toHaveCount(2);
      for (const image of await frame.locator('img').all()) {
        await expect(image).toHaveAttribute('src', new RegExp(`^/service-media/${owner}/2/`, 'u'));
      }
      await expect(frame.locator('img[srcset]')).toHaveAttribute('srcset', /small 640w/u);
      const size = await frame.evaluate((element) => Math.ceil(element.clientWidth));
      await expect(frame.locator('img[srcset]')).toHaveAttribute('sizes', `${size}px`);
      expect(requests.every((url) => url.startsWith(`/service-media/${owner}/2/`))).toBe(true);
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('site-photo-resolved.png') });
    } finally { release(); }
  });
}
