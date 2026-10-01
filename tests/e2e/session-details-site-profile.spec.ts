import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const immersive = process.env.CADRORA_SITE === 'atelier-giulia';
const session = {
  id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
  imageRevision: null, imageSources: [],
  copy: {
    fr: { title: 'Familles', shortDescription: 'Vos liens en images.', description: 'Une séance pour toute votre famille.',
      points: ['Galerie privée', 'Photos choisies ensemble'], duration: 'Une heure', priceRange: '250 $ à 400 $',
      details: 'Nous préparons la séance ensemble.\nChoisissez vos tenues préférées.' },
    en: { title: 'Families', shortDescription: 'Your connections in pictures.', description: 'A session for your whole family.',
      points: ['Private gallery', 'Photos chosen together'], duration: 'One hour', priceRange: '$250 to $400',
      details: 'We plan the session together.\nBring your favourite outfits.' },
  },
};
const sessions = [session, { ...session, id: 'wedding', sortOrder: 1 },
  { ...session, id: 'portrait', sortOrder: 2, showOnHome: false },
  { ...session, id: 'brand', sortOrder: 3, enabled: false }];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: {
    siteName: 'Example Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: 'hello@example.test', contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['family', 'wedding', 'portrait'], themeMode: 'both', analyticsMeasurementId: null,
    galleryDirectoryEnabled: false, homeGalleries: { enabled: false, limit: 6 },
    updatedAt: '2026-09-30T00:00:00.000Z',
  } }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ json: sessions }));
});

for (const language of ['fr', 'en'] as const) {
  test(`${language}: Home and Sessions share details, restore focus, and carry the session to Contact`, async ({ page }, testInfo) => {
    const label = language === 'fr' ? 'Découvrir cette séance' : 'Explore this session';
    const contactLabel = language === 'fr' ? 'Parlons de votre séance' : 'Let’s talk about your session';
    const title = session.copy[language].title;
    await page.goto(`/${language}/`);
    const consent = page.getByRole('button', { name: /nécessaire seulement|necessary only/i });
    if (await consent.isVisible()) await consent.click();
    const homeCards = page.locator(immersive ? '.swiper-slide.session-story__panel' : '.service-card');
    await expect(homeCards).toHaveCount(2);
    if (immersive) {
      await page.locator('.vertical-story-slider__pagination button').nth(1).click();
      await expect(homeCards.nth(1)).toHaveClass(/swiper-slide-active/u);
    }
    const homeIndex = immersive ? 1 : 0;
    const selectedId = immersive ? 'wedding' : 'family';
    const opener = homeCards.nth(homeIndex).getByRole('button', { name: label });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toContainText(session.copy[language].description);
    await expect(dialog).toContainText(session.copy[language].duration);
    await expect(dialog).toContainText(session.copy[language].priceRange);
    await expect(dialog).toContainText(session.copy[language].points[0]);
    await expect(dialog).toContainText(session.copy[language].details.split('\n')[0] ?? '');
    await expect(dialog.getByRole('link', { name: contactLabel })).toHaveAttribute('href', `/${language}/contact?session=${selectedId}`);
    const homeDetails = await dialog.locator('.service-details-modal__body').innerText();
    await page.screenshot({ path: testInfo.outputPath('session-details.png') });
    if (testInfo.project.name === 'mobile-chromium') {
      const box = await dialog.boundingBox();
      expect(box?.width).toBe(page.viewportSize()?.width);
      expect(box?.height).toBe(page.viewportSize()?.height);
    }
    if (immersive) {
      await expect(page.locator('.session-story')).toHaveAttribute('inert', '');
      await page.keyboard.press('ArrowDown');
      await dialog.hover();
      await page.mouse.wheel(0, 800);
      await expect(homeCards.nth(homeIndex)).toHaveClass(/swiper-slide-active/u);
    }
    // Tab cycles within the dialog, then Escape returns to the same Home trigger.
    await dialog.getByRole('link', { name: contactLabel }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    if (immersive) {
      await expect(page.locator('.session-story')).not.toHaveAttribute('inert', '');
      await expect(homeCards.nth(homeIndex)).toHaveClass(/swiper-slide-active/u);
      const next = page.locator('.vertical-story-slider__pagination button').first();
      await next.click();
      await expect(homeCards.first()).toHaveClass(/swiper-slide-active/u);
    }
    if (immersive) await expect(page.locator('.session-story__all')).toHaveCount(0);
    await page.goto(`/${language}/services`);
    await expect(page).toHaveURL(`/${language}/services`);
    const cards = page.locator('.service-detail-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText(session.copy[language].shortDescription);
    await expect(cards.first()).not.toContainText(session.copy[language].description);
    await cards.first().getByRole('button', { name: label }).click();
    await expect(dialog.locator('.service-details-modal__body')).toHaveText(homeDetails, { useInnerText: true });
    await dialog.getByRole('link', { name: contactLabel }).click();
    await expect(page).toHaveURL(`/${language}/contact?session=family`);
    await expect(page.locator('.contact-page__session')).toContainText(title);
    await expect(page.getByRole('link', { name: 'hello@example.test' })).toHaveAttribute('href', 'mailto:hello@example.test');
    if (await page.locator('.public-header__language').isHidden()) await page.locator('.public-header__menu').click();
    await page.locator('.public-header__language').click();
    const other = language === 'fr' ? 'en' : 'fr';
    await expect(page).toHaveURL(`/${other}/contact?session=family`);
    await expect(page.locator('.contact-page__session')).toContainText(session.copy[other].title);
    await assertNoHorizontalOverflow(page);
  });
}

test('Contact remains usable with invalid, unknown, disabled, or unavailable session context', async ({ page }) => {
  for (const id of ['invalid/id', 'unknown-session', 'brand']) {
    await page.goto(`/en/contact?session=${encodeURIComponent(id)}`);
    await expect(page.getByRole('link', { name: 'hello@example.test' })).toBeVisible();
    await expect(page.locator('.contact-page__session')).toHaveCount(0);
  }
  await page.route('**/api/v1/services', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/en/contact?session=unknown-session');
  await expect(page.getByRole('link', { name: 'hello@example.test' })).toBeVisible();
  await expect(page.locator('.contact-page__session')).toHaveCount(0);
});
