import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const session = {
  id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
  imageRevision: null, imageSources: [],
  copy: {
    fr: { title: 'Familles', shortDescription: 'Des souvenirs ensemble.', description: 'Une séance à votre rythme.', points: ['Galerie privée'],
      priceRange: 'Mini 250 $ · Signature 450 $ · Complète 650 $ CAD', goodToKnow: 'Déplacements inclus sur la Rive-Sud. Acompte de 50 %.',
      tariffs: [
        { name: 'Mini — Little Moments', price: '250 $ CAD', summary: 'Une heure, plus de 40 photos et un aperçu sous 48 heures.' },
        { name: 'Signature — The Party', price: '450 $ CAD', summary: 'Deux heures, plus de 100 photos et un aperçu sous 24 heures.' },
        { name: 'Complète — The Whole Celebration', price: '650 $ CAD', summary: 'Jusqu’à trois heures et plus de 200 photos dans votre galerie privée.' },
      ] },
    en: { title: 'Families', shortDescription: 'Memories together.', description: 'A session at your pace.', points: ['Private gallery'],
      priceRange: 'Mini $250 · Signature $450 · Complete $650 CAD', goodToKnow: 'Travel included in the Rive-Sud. 50% deposit.',
      tariffs: [
        { name: 'Mini — Little Moments', price: '$250 CAD', summary: 'One hour, 40+ photos and sneak peeks within 48 hours.' },
        { name: 'Signature — The Party', price: '$450 CAD', summary: 'Two hours, 100+ photos and sneak peeks within 24 hours.' },
        { name: 'Complete — The Whole Celebration', price: '$650 CAD', summary: 'Up to three hours and 200+ photos in your private gallery.' },
      ] },
  },
};

test('owner edits package pricing and practical information on desktop and phone', async ({ page }, testInfo) => {
  const language = testInfo.project.name === 'mobile-chromium' ? 'en' : 'fr';
  await page.addInitScript(locale => localStorage.setItem('cadrora-language', locale), language);
  let card = structuredClone(session);
  let saves = 0;
  const settings = { siteName: 'Example Studio', defaultLanguage: language, enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['family'], themeMode: 'light', analyticsMeasurementId: null,
    homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-25T00:00:00.000Z' };
  await page.route('**/api/v1/site', route => route.fulfill({ json: settings }));
  await page.route('**/api/v1/admin/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/session')) body = { access: 'manage', authMode: 'password', createdAt: '2026-10-25T00:00:00.000Z',
      expiresAt: '2030-10-25T00:00:00.000Z', id: 'owner-test', subject: 'owner', revokedAt: null };
    if (path.endsWith('/site')) body = { ...settings,
      quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
      quotas: { faceLimit: 10000, storageLimitBytes: 2000000000 }, usage: { faces: 0, storageBytes: 0 } };
    if (path.endsWith('/services')) body = [card];
    if (path.endsWith('/services/family') && route.request().method() === 'PATCH') {
      card = { ...card, ...route.request().postDataJSON() as typeof session };
      saves += 1;
      body = card;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/admin/login');
  await page.evaluate(() => { history.pushState({}, '', '/admin/settings'); dispatchEvent(new PopStateEvent('popstate')); });
  const editor = page.locator('.admin-service-catalog .admin-service-editor');
  await editor.locator('summary').focus();
  await page.keyboard.press('Space');
  const price = editor.getByRole('textbox', { name: language === 'fr' ? 'Prix du forfait 2 · Français' : 'Package 2 price · English' });
  await price.fill('475 CAD');
  const practical = editor.getByRole('textbox', { name: language === 'fr' ? 'Bon à savoir (facultatif) · Français' : 'Good to know (optional) · English' });
  await practical.fill('Travel included.');
  await price.focus();
  await page.keyboard.press('Tab');
  await expect(editor.getByRole('button', { name: language === 'fr' ? 'Traductions : Prix du forfait 2' : 'Translations: Package 2 price' })).toBeFocused();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('admin-pricing.png') });
  await editor.getByRole('button', { name: language === 'fr' ? 'Enregistrer la séance' : 'Save session', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  expect(card.copy[language].tariffs[1]?.price).toBe('475 CAD');
  expect(card.copy[language].goodToKnow).toBe('Travel included.');
  expect(card.copy[language === 'fr' ? 'en' : 'fr']).toEqual({ ...session.copy[language === 'fr' ? 'en' : 'fr'], duration: '', details: '' });
});

for (const language of ['fr', 'en'] as const) {
  test(`${language}: package bullets and practical information fit the shared dialog and remain keyboard accessible`, async ({ page }, testInfo) => {
    await page.route('**/api/v1/site', route => route.fulfill({ json: {
      siteName: 'Example Studio', defaultLanguage: language, enabledLanguages: ['fr', 'en'],
      contactEmail: 'hello@example.test', contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['family'], themeMode: 'light', analyticsMeasurementId: null,
      galleryDirectoryEnabled: false, homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-25T00:00:00.000Z',
    } }));
    await page.route('**/api/v1/services', route => route.fulfill({ json: [session] }));
    await page.goto(`/${language}/services`);
    const consent = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
    if (await consent.isVisible()) await consent.click();
    const opener = page.getByRole('button', { name: language === 'fr' ? 'Découvrir cette séance' : 'Explore this session' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: session.copy[language].title });
    await expect(dialog).toContainText(session.copy[language].priceRange);
    await expect(dialog.locator('.service-details-modal__tariffs > li')).toHaveCount(3);
    for (const tariff of session.copy[language].tariffs) {
      await expect(dialog).toContainText(tariff.name);
      await expect(dialog).toContainText(tariff.summary);
    }
    const practical = dialog.getByRole('region', { name: language === 'fr' ? 'Bon à savoir' : 'Good to know' });
    await practical.scrollIntoViewIfNeeded();
    await expect(practical).toContainText(session.copy[language].goodToKnow);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('pricing-packages.png') });
    await dialog.getByRole('link').focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.route('**/api/v1/services', route => route.fulfill({ json: [{ ...session, copy: {
      fr: { ...session.copy.fr, tariffs: session.copy.fr.tariffs.slice(0, 1), goodToKnow: '' },
      en: { ...session.copy.en, tariffs: session.copy.en.tariffs.slice(0, 1), goodToKnow: '' },
    } }] }));
    await page.reload();
    await opener.click();
    await expect(dialog).toContainText(session.copy[language].tariffs[0].price);
    await expect(dialog.locator('.service-details-modal__tariffs')).toHaveCount(0);
    await expect(dialog.locator('.service-details-modal__good-to-know')).toHaveCount(0);
    await expect(dialog).not.toContainText(session.copy[language].priceRange);
  });
}
