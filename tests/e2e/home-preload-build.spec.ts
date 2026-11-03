import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test.skip(process.env.CADRORA_E2E_BUILD !== 'true', 'Requires the optimized build.');
const atelier = process.env.CADRORA_SITE === 'atelier-giulia';

test('only the opted-in Home document carries a public settings snapshot and photo hint', async ({ request }) => {
  for (const path of ['/', '/fr/', '/en/']) {
    const response = await request.get(path);
    const html = await response.text();
    expect(html.includes('data-home-photo-preload')).toBe(!atelier);
    expect(html.includes('id="cadrora-initial-site"')).toBe(!atelier);
  }
  expect(await (await request.get('/fr/contact/')).text()).not.toContain('data-home-photo-preload');
});

for (const width of [320, 390, 768, 1440]) {
  for (const dpr of [1, 2]) {
    test(`owner photo preload is reused at ${width}px DPR ${dpr}`, async ({ browser, baseURL }) => {
      test.skip(atelier, 'Atelier has no editorial photo hint.');
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      const images: string[] = [];
      let bundleReleased = false;
      let photoBeforeBundle = false;
      try {
        await page.route('**/fr/', async route => {
          const response = await route.fetch();
          const template = (await response.text()).replace(/<link data-home-photo-preload[^>]*>/gu, '')
            .replace(/<script id="cadrora-initial-site"[^>]*>[\s\S]*?<\/script>/gu, '');
          // A server-output fixture; unit tests cover D1 selection and failure behavior.
          const settings = await (await context.request.get(`${baseURL}/api/v1/site`)).json() as Record<string, unknown>;
          const snapshot = { ...settings, siteName: 'Published owner', homeHeroImageRevision: 7,
            homeHeroImageMediumWidth: 960, homeHeroImageLargeWidth: 1280 };
          const hint = '<link data-home-photo-preload rel="preload" as="image" fetchpriority="high" imagesrcset="/service-media/home-hero/7/preview 320w, /service-media/home-hero/7/small 640w, /service-media/home-hero/7/medium 960w, /service-media/home-hero/7/large 1280w" imagesizes="95vw">';
          const json = JSON.stringify(snapshot).replaceAll('<', '\\u003c');
          await route.fulfill({ response, body: template.replace('</head>', () => `${hint}<script id="cadrora-initial-site" type="application/json">${json}</script></head>`) });
        });
        await page.route('**/assets/index-*.js', async route => {
          await new Promise(resolve => setTimeout(resolve, 900));
          bundleReleased = true;
          await route.continue();
        });
        await page.route('**/api/v1/site', route => route.abort());
        await page.route('**/service-media/home-hero/7/*', route => {
          images.push(route.request().url());
          if (!bundleReleased) photoBeforeBundle = true;
          return route.fulfill({ path: resolve('public/brand/demo-hero.webp'), contentType: 'image/webp' });
        });
        const defaults: string[] = [];
        page.on('request', request => { if (request.url().includes('/home-hero-image/')) defaults.push(request.url()); });
        await page.goto(`${baseURL}/fr/`);
        await expect(page.locator('.public-brand__name')).toHaveText('Published owner');
        const photo = page.locator('.site-hero__art .progressive-photo__optimized');
        await expect(photo).toBeVisible();
        const selected = await photo.evaluate((image: HTMLImageElement) => image.currentSrc);
        expect(photoBeforeBundle).toBe(true);
        expect(images[0]).toBe(selected);
        expect(images.filter(url => url === selected)).toHaveLength(1);
        expect(defaults).toEqual([]);
        await expect(photo).toHaveAttribute('sizes', '95vw');
      } finally { await context.close(); }
    });
  }
}

for (const language of ['fr', 'en']) {
  test(`collection 404 is readable and navigable without JavaScript (${language})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 740 } });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${baseURL}/${language}/portfolio/nonexistent-qa-collection/`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(language === 'fr' ? 'Page introuvable' : 'Page not found');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Portfolio', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: language === 'fr' ? 'Accueil' : 'Home', exact: true })).toBeFocused();
    } finally { await context.close(); }
  });
}
