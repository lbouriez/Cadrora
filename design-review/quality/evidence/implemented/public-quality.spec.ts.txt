import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';

async function configureSite(page: Page, analytics = false, siteName = 'Cadrora') {
  const settings = {
    siteName, defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: 'bonjour@example.com', contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], homeGalleries: { enabled: false, limit: 6 },
    analyticsMeasurementId: analytics ? 'G-REVIEW123' : null, themeMode: 'both',
    updatedAt: '2026-11-02T00:00:00.000Z',
  };
  await page.route('**/api/v1/site', route => route.fulfill({ json: settings }));
}

async function expectUncovered(target: Locator) {
  await expect.poll(() => target.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return rect.top >= 0 && rect.bottom <= innerHeight && (hit === element || element.contains(hit));
  })).toBe(true);
}

for (const language of ['fr', 'en']) {
  for (const analytics of [false, true]) {
    test(`consent leaves footer and compact navigation usable (${language}, analytics ${String(analytics)})`, async ({ page }) => {
      await configureSite(page, analytics);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${language}/contact`);
      await expect(page.locator('.privacy-consent')).toBeVisible();
      await expect(page.locator('.privacy-consent button')).toHaveCount(analytics ? 2 : 1);
      const footerStops = page.locator('.public-footer nav').locator('a,button');
      await footerStops.nth(await footerStops.count() - 2).focus();
      await page.keyboard.press('Tab');
      await expect(footerStops.last()).toBeFocused();
      await expectUncovered(footerStops.last());

      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto(`/${language}/contact`);
      const menu = page.locator('.public-header__menu');
      await menu.click();
      const links = page.locator('#public-navigation a');
      await links.first().focus();
      for (let index = 0; index < await links.count(); index += 1) {
        await expect(links.nth(index)).toBeFocused();
        await expectUncovered(links.nth(index));
        if (index + 1 < await links.count()) await page.keyboard.press('Tab');
      }
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await page.locator('.privacy-consent button').first().click();
      await expect(page.locator('.privacy-consent')).toHaveCount(0);
      await expect(page.locator('.public-shell')).toHaveCSS('padding-bottom', '0px');
      await page.locator('.public-footer__button').click();
      await expect(page.locator('.privacy-consent')).toBeVisible();
      await expect.poll(() => page.locator('.public-shell').evaluate(e => Number.parseFloat(getComputedStyle(e).paddingBottom))).toBeGreaterThan(0);
    });
  }
}

test('enlarged header preserves owner branding and every control', async ({ page }) => {
  await configureSite(page, false, 'Studio de photographie et portraits');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/en/contact');
    await expect(page.locator('.public-brand__name')).toHaveText('Studio de photographie et portraits');
    await page.locator('.privacy-consent button').first().click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const bounds = await page.locator('.public-header').evaluate(element => {
      const brand = element.querySelector('.public-brand')!.getBoundingClientRect();
      const controls = element.querySelector('.public-header__controls')!.getBoundingClientRect();
      return { separated: brand.bottom <= controls.top || brand.right <= controls.left,
        controlsFit: controls.left >= 0 && controls.right <= innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds).toEqual({ separated: true, controlsFit: true, overflow: false });
    for (const control of await page.locator('.public-header__controls button').all()) await expectUncovered(control);
    // Restore the notice for the next independent navigation.
    await page.evaluate(() => localStorage.removeItem('cadrora-privacy-consent-v1'));
  }
});
