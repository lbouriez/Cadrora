import { expect, test } from '@playwright/test';
import { loadSiteProfile } from '../../scripts/sites/loadProfile.mjs';
import { assertNoHorizontalOverflow } from './fixtures';

const profile = loadSiteProfile(process.env.CADRORA_SITE || 'cadrora');

for (const language of ['fr', 'en']) {
  test(`${language}: selected profile stays usable without the gallery API`, async ({ page }, testInfo) => {
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
    await page.goto(`/${language}/`);
    await expect(page.locator('html')).toHaveAttribute('data-site', profile.id);
    await expect(page.locator('.public-brand')).toContainText(profile.name);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.site-startup')).toHaveCount(0);
    // Visit the complete page as a reader would: reveals and lazy photos must
    // settle before capturing the design, including the below-fold sections.
    for (const block of await page.locator('.motion-reveal').all()) {
      await block.scrollIntoViewIfNeeded();
      await expect(block).toHaveClass(/motion-reveal--visible/u);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    await page.goto(`/${language}/contact/`);
    await expect(page.locator('.public-brand')).toContainText(profile.name);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('contact.png'), fullPage: true });
  });
}
