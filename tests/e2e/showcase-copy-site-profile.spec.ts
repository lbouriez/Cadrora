import { expect, test, assertNoHorizontalOverflow } from './fixtures';

const atelier = process.env.CADRORA_SITE === 'atelier-giulia';

for (const language of ['fr', 'en'] as const) {
  test(`Home copy and actions stay clear in ${language}`, async ({ page }, testInfo) => {
    await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
      siteName: atelier ? 'Atelier Giulia' : 'Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['wedding', 'family'], analyticsMeasurementId: null, themeMode: 'light',
      galleryDirectoryEnabled: !atelier, homeGalleries: { enabled: false, limit: 6 },
      updatedAt: '2026-10-19T00:00:00.000Z',
    } }));
    await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503 }));
    await page.goto(`/${language}/`);
    await expect(page.locator('.site-startup')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    const consent = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
    if (await consent.isVisible()) await consent.click();
    await assertNoHorizontalOverflow(page);
    if (atelier) {
      await expect(page.locator('.session-story')).toBeVisible();
      await expect(page.locator('.session-story__introduction')).toContainText(language === 'fr'
        ? 'racontez-nous votre projet' : 'tell us about your plans');
      await expect(page.locator('#demo')).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(language === 'fr'
        ? 'Vos photos. Vos galeries. Votre propre site.' : 'Your work. Your galleries. Your own website.');
      await page.getByRole('link', { name: language === 'fr' ? 'Essayer la démo' : 'Try the demo', exact: true }).click();
      await expect(page.locator('#demo-title')).toBeInViewport();
      await expect(page.locator('#demo a')).toHaveCount(4);
      await page.getByRole('link', { name: language === 'fr' ? 'Créer mon site' : 'Set up my website', exact: true }).click();
      await expect(page.locator('#stack-title')).toBeInViewport();
      await expect(page.locator('#installation a')).toHaveAttribute('href', 'https://github.com/lbouriez/Cadrora');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    }
    await page.screenshot({ path: `.artifacts/review-2026-10-19/fixed-${atelier ? 'atelier' : 'cadrora'}-${language}-${testInfo.project.name}.png` });
  });
}
