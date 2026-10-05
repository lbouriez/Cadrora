import { expect, test } from '@playwright/test';

test.skip(process.env.CADRORA_MARKETING_PRERENDER !== 'true', 'Isolated preview renderer only.');

for (const language of ['fr', 'en']) {
  for (const route of ['', 'services/']) {
    test(`${language} ${route || 'Home'} preserves the HTML photo when JavaScript arrives late`, async ({ page, request }) => {
      const path = `/${language}/${route}`;
      const response = await request.get(path);
      expect(response.headers()['x-cadrora-rendering']).toBe('worker-preview');
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(await response.text()).toContain('cadrora-marketing-snapshot');
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error' && /hydration|hydrating|react error/i.test(message.text())) errors.push(message.text()); });
      await page.addInitScript(() => {
        localStorage.setItem('cadrora-theme', 'dark');
        localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
      });
      let release = () => {};
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/assets/index-*.js', async (request) => { await gate; await request.continue(); });
      try {
        await page.goto(path, { waitUntil: 'commit' });
        const photo = page.locator('.progressive-photo--priority .progressive-photo__optimized').first();
        await photo.waitFor({ state: 'attached' });
        await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.complete)).toBe(true);
        const original = await photo.elementHandle();
        await expect(page.locator('.site-startup__brand')).toBeInViewport();
        await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
        release();
        await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
        await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
        expect(await photo.evaluate((current, previous) => current === previous, original)).toBe(true);
        await expect(page.locator('.privacy-consent')).toHaveCount(0);
        expect(errors).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (route) {
          await page.locator('.service-detail-card button').first().click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
        }
        await page.locator('.public-header__language').click();
        await expect(page).toHaveURL(new RegExp(`/${language === 'fr' ? 'en' : 'fr'}(?:/|$)`));
        expect(errors).toEqual([]);
      } finally { release(); }
    });
  }
}

test('direct Home fragment navigation survives the startup frame', async ({ page }) => {
  await page.goto('/fr/#services');
  await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#services')).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('late CSS shows only the styled identity, then the complete page', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/assets/*.css', async (request) => { await gate; await request.continue(); });
  try {
    await page.goto('/fr/', { waitUntil: 'commit' });
    await expect(page.locator('.site-startup__brand')).toBeInViewport();
    await expect(page.locator('.site-startup')).toHaveCSS('display', 'grid');
    await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '0');
    await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
    release();
    await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
    await expect(page.locator('.site-startup')).toHaveCount(0);
  } finally { release(); }
});

test('failed CSS keeps styled native navigation instead of exposing raw HTML', async ({ page }) => {
  await page.route('**/assets/*.css', (request) => request.abort());
  await page.goto('/fr/');
  await expect(page.locator('.site-startup__brand')).toBeInViewport();
  await expect(page.locator('.site-startup')).toHaveCSS('display', 'grid');
  await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '0');
  await page.locator('.site-startup__fallback summary').click();
  await expect(page.locator('.site-startup__fallback a[href$="/contact"]')).toBeVisible();
});

test('root hydration restores saved language, theme and consent before interaction', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cadrora-language', 'en');
    localStorage.setItem('cadrora-theme', 'dark');
    localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
  });
  await page.goto('/');
  await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.privacy-consent')).toHaveCount(0);
  await page.locator('.public-header__theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  if (isMobile) await page.locator('.public-header__menu').click();
  await page.locator('#public-navigation a[href$="/contact"]').click();
  await expect(page).toHaveURL(/\/en\/contact$/u);
  await page.goBack();
  await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.privacy-consent')).toHaveCount(0);
});

test('slow visible hero preserves the identity, including reduced motion', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The Home photo is below the mobile first viewport.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/(?:home-hero-image|service-media\/home-hero\/\d+)\/(?:small|medium|large)/u,
    async (request) => { await gate; await request.continue(); });
  try {
    await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.site-startup__brand')).toBeInViewport();
    await expect(page.locator('.session-home__stage')).toHaveAttribute('inert', '');
    release();
    await expect(page.locator('.session-home__stage')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.session-home__stage')).toHaveCSS('opacity', '1');
  } finally { release(); }
});
