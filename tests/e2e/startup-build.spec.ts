import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow } from './fixtures';

// The localized HTML is generated after Vite builds; a dev-server test cannot
// catch the raw SEO fallback or the missing pre-JavaScript profile attribute.
test.skip(process.env.CADRORA_E2E_BUILD !== 'true', 'Requires npm run build and CADRORA_E2E_BUILD=true.');

const siteId = process.env.CADRORA_SITE || 'cadrora';
const atelier = siteId === 'atelier-giulia';

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
