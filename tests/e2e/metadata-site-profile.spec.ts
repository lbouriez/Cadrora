import cadrora from '../../sites/cadrora/profile.json' with { type: 'json' };
import { expect, test } from './fixtures';

const atelier = process.env.CADRORA_SITE === 'atelier-giulia';

for (const language of ['fr', 'en'] as const) {
  test(`brand metadata keeps the correct source in ${language}`, async ({ page }) => {
    const ownerCopy = {
      fr: { description: 'Description du studio enregistrée.', footerTagline: 'Signature du studio.' },
      en: { description: 'Saved studio description.', footerTagline: 'Studio signature.' },
    };
    await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
      siteName: atelier ? 'Atelier Giulia' : 'Cadrora', defaultLanguage: language, enabledLanguages: ['fr', 'en'],
      siteCopy: ownerCopy,
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: 'Example region',
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['family'], analyticsMeasurementId: null, themeMode: 'light',
      sessionsPageEnabled: true, aboutEnabled: true, galleryDirectoryEnabled: false,
      homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-25T00:00:00.000Z',
    } }));
    await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503 }));

    for (const key of ['home', 'contact', 'services', 'privacy'] as const) {
      await page.goto(`/${language}/${key === 'home' ? '' : key}`);
      const expected = atelier
        ? ownerCopy[language].description + (key === 'privacy' ? ''
          : language === 'fr' ? ' Région desservie : Example region.' : ' Service area: Example region.')
        : cadrora.document.pages[key][language].description;
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', expected);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', expected);
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', expected);
      await expect(page.locator('.public-footer')).toContainText(atelier ? ownerCopy[language].footerTagline
        : language === 'fr' ? 'Votre site photo et vos galeries.' : 'Your photography website and galleries.');
      if (!atelier) await expect(page.locator('#site-organization')).not.toContainText('areaServed');
    }
  });
}
