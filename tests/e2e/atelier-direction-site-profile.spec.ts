import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const immersive = process.env.CADRORA_SITE === 'atelier-giulia';
const ownerSettings = {
  siteName: 'Owner Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: 'owner@example.test', contactPhone: '+1 514 555 0101', contactAddress: '', serviceArea: '',
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['family'], themeMode: 'light', analyticsMeasurementId: 'G-TEST123456',
  constructionNoticeEnabled: true, sessionsPageEnabled: true, aboutEnabled: true,
  galleryDirectoryEnabled: false, homeGalleries: { enabled: false, limit: 6 },
  updatedAt: '2026-11-02T00:00:00.000Z',
};
const copy = {
  fr: { title: 'Portraits et familles', shortDescription: 'Vos liens en images.', description: 'Notre récit complet.',
    points: ['Photos choisies ensemble'], duration: 'Une heure', priceRange: 'Prix propriétaire',
    tariffs: [{ name: 'Émotions & lumière', price: '350 $ CAD', summary: 'Dix photos choisies ensemble.' }],
    goodToKnow: 'Conditions du propriétaire.', details: 'Préparation de votre séance.' },
  en: { title: 'Portraits & families', shortDescription: 'Your connections in pictures.', description: 'Our complete story.',
    points: ['Photos chosen together'], duration: 'One hour', priceRange: 'Owner price',
    tariffs: [{ name: 'Light & feeling', price: 'CAD $350', summary: 'Ten photos chosen together.' }],
    goodToKnow: 'Owner conditions.', details: 'Preparing your session.' },
};
const card = { id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
  imageRevision: null, imageSources: [], copy };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/site', route => route.fulfill({ json: ownerSettings }));
  await page.route('**/api/v1/services', route => route.fulfill({ json: [card, { ...card, id: 'portrait', sortOrder: 1 }] }));
  await page.route(/google-analytics|googletagmanager/u, route => route.abort());
});

test('vertical wheel turns pages horizontally with a fixed header and footer only on the last slide', async ({ page }) => {
  test.skip(!immersive, 'Atelier horizontal presentation.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/fr/');
  await page.getByRole('button', { name: /nécessaire seulement/iu }).click();
  const slider = page.locator('.vertical-story-slider');
  await expect(slider).toHaveClass(/swiper-horizontal/u);
  const masthead = page.locator('.public-masthead');
  const footer = page.locator('.public-footer');
  await expect(footer).toBeHidden();
  await expect(footer).toHaveAttribute('inert');
  await page.mouse.move(100, 200);
  await page.mouse.wheel(0, 400);
  const matrix = () => page.locator('.swiper-wrapper').evaluate(element => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: transform.m41, y: transform.m42 };
  });
  await expect.poll(async () => (await matrix()).x).toBeLessThan(-1);
  expect((await matrix()).y).toBe(0);
  const photoScales = await page.locator('.session-story__visual').evaluateAll(async (elements) => {
    const samples: number[] = [];
    for (let frame = 0; frame < 20; frame += 1) {
      await new Promise(requestAnimationFrame);
      for (const element of elements) {
        const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        samples.push(transform.m11, transform.m22);
      }
    }
    return samples;
  });
  for (const scale of photoScales) expect(scale).toBeCloseTo(1, 4);
  await expect(masthead).toBeInViewport({ ratio: 1 });
  await expect(footer).toBeInViewport({ ratio: 1 });
  await expect(footer).toBeVisible();
  await expect(footer).not.toHaveAttribute('inert');
  await expect(page.locator('.vertical-story-slider__pagination button').nth(1)).toHaveAttribute('aria-current', 'step');
  await expect.poll(() => slider.evaluate(element =>
    (element as HTMLElement & { swiper?: { animating: boolean } }).swiper?.animating)).toBe(false);
  expect((await matrix()).x).toBeCloseTo(-(page.viewportSize()?.width ?? 0), 0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.vertical-story-slider__pagination button').first()).toHaveAttribute('aria-current', 'step');
  await expect(footer).toBeHidden();
  await expect(footer).toHaveAttribute('inert');
});

for (const language of ['fr', 'en'] as const) {
  test(`${language}: right-side dots keep the current session reachable in a short viewport`, async ({ page }) => {
    test.skip(!immersive, 'Atelier side pagination.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cards = ['family', 'portrait', 'wedding', 'maternity', 'brand', 'work', 'kids', 'events', 'other']
      .map((id, sortOrder) => ({ ...card, id, sortOrder }));
    await page.route('**/api/v1/services', route => route.fulfill({ json: cards }));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/${language}/`);
    await page.getByRole('button', { name: /nécessaire seulement|necessary only/iu }).click();
    const pagination = page.locator('.vertical-story-slider__pagination');
    const buttons = pagination.getByRole('button');
    await expect(buttons).toHaveCount(cards.length);
    await expect(pagination).toBeInViewport({ ratio: 1 });
    const box = (await pagination.boundingBox())!;
    expect(box.x).toBeGreaterThan(270);
    expect(box.width).toBe(44);
    for (const button of await buttons.all()) {
      const target = (await button.boundingBox())!;
      const dot = (await button.locator('span').boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.x).toBeCloseTo(box.x, 0);
      expect(dot.width).toBeCloseTo(dot.height, 1);
      expect(dot.width).toBeLessThan(10);
    }
    await page.locator('.vertical-story-slider').focus();
    for (let index = 1; index < cards.length; index += 1) {
      await page.keyboard.press('ArrowRight');
      await expect(buttons.nth(index)).toHaveAttribute('aria-current', 'step');
      await expect(buttons.nth(index)).toBeInViewport({ ratio: 1 });
    }
    expect(await pagination.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    for (let index = cards.length - 2; index >= 0; index -= 1) {
      await page.keyboard.press('ArrowLeft');
      await expect(buttons.nth(index)).toHaveAttribute('aria-current', 'step');
      await expect(buttons.nth(index)).toBeInViewport({ ratio: 1 });
    }
    await buttons.nth(2).focus();
    await page.keyboard.press('Enter');
    await expect(buttons.nth(2)).toHaveAttribute('aria-current', 'step');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await assertNoHorizontalOverflow(page);
  });
}

for (const language of ['fr', 'en'] as const) {
  test(`${language}: owner package selection reaches the email subject and supports copying`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } }));
    await page.goto(`/${language}/services`);
    await page.getByRole('button', { name: /nécessaire seulement|necessary only/iu }).click();
    await page.locator('.service-detail-card').first().getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.service-details-modal__summary')).toContainText(copy[language].duration);
    await expect(dialog.locator('.service-details-modal__tariffs')).toContainText(copy[language].tariffs[0].price);
    await expect(dialog.locator('.service-details-modal__good-to-know')).toBeVisible();
    await expect(dialog.locator('details')).not.toHaveAttribute('open');
    await dialog.locator('.service-details-modal__tariffs a').click();
    await expect(page).toHaveURL(`/${language}/contact?session=family&tariff=0`);
    const subject = `${copy[language].title} — ${copy[language].tariffs[0].name}`;
    await expect(page.getByRole('link', { name: ownerSettings.contactEmail })).toHaveAttribute('href',
      `mailto:${ownerSettings.contactEmail}?subject=${encodeURIComponent(subject)}`);
    await page.getByRole('button', { name: /Copier le courriel|Copy email address/u }).click();
    await expect(page.locator('.contact-list__copy [role=status]')).toHaveText(/copiée|copied/u);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Unavailable')) } }));
    await page.getByRole('button', { name: /Copier le courriel|Copy email address/u }).click();
    await expect(page.locator('.contact-list__copy [role=status]')).toHaveText(/indisponible|unavailable/u);
    await expect(page.getByRole('link', { name: ownerSettings.contactEmail })).toBeVisible();
    for (const tariff of ['8', '-1', '0.5', 'unknown', '999']) {
      await page.goto(`/${language}/contact?session=family&tariff=${tariff}`);
      await expect(page.getByRole('link', { name: ownerSettings.contactEmail })).toHaveAttribute('href',
        `mailto:${ownerSettings.contactEmail}?subject=${encodeURIComponent(copy[language].title)}`);
    }
    await assertNoHorizontalOverflow(page);
  });
}

test('first visit keeps title, action and consent choices reachable, with the footer on the last slide', async ({ page }) => {
  test.skip(!immersive, 'Atelier immersive presentation.');
  await page.goto('/fr/');
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const action = page.locator('.swiper-slide-active .session-story__cta');
    await expect(action).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.public-footer')).toBeHidden();
    for (const button of await page.locator('.privacy-consent__actions button').all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await expect.poll(async () => (await page.locator('.swiper-slide-active .session-story__text').boundingBox())?.height ?? 0).toBeGreaterThan(28);
    await expect.poll(async () => {
      const textBox = (await page.locator('.swiper-slide-active .session-story__text').boundingBox())!;
      const headingBox = (await page.locator('.swiper-slide-active h1').boundingBox())!;
      return headingBox.y + headingBox.height - textBox.y - textBox.height;
    }).toBeLessThanOrEqual(1);
    const actionBox = (await action.boundingBox())!;
    const consentBox = (await page.locator('.privacy-consent').boundingBox())!;
    const paginationBox = (await page.locator('.vertical-story-slider__pagination').boundingBox())!;
    await expect(page.locator('.vertical-story-slider__pagination')).toBeInViewport({ ratio: 1 });
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(paginationBox.x);
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(consentBox.y);
    expect(paginationBox.y + paginationBox.height).toBeLessThanOrEqual(consentBox.y + 1);
    await assertNoHorizontalOverflow(page);
  }
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await page.getByRole('button', { name: /nécessaire seulement/iu }).click();
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await page.locator('.vertical-story-slider__page').last().click();
  await expect(page.locator('.public-footer')).toBeVisible();
  await page.getByRole('button', { name: 'Gérer mes choix' }).click();
  await expect(page.locator('.privacy-consent')).toBeVisible();
  const footerBox = (await page.locator('.public-footer').boundingBox())!;
  const consentBox = (await page.locator('.privacy-consent').boundingBox())!;
  expect(consentBox.y + consentBox.height).toBeCloseTo(footerBox.y, 0);
});

test('long owner text scrolls independently while the action stays visible at enlarged type', async ({ page }) => {
  test.skip(!immersive, 'Atelier immersive presentation.');
  const longCopy = { ...copy, fr: { ...copy.fr, title: 'Portraits pour toutes les générations de votre famille',
    shortDescription: 'Une séance avec votre famille. '.repeat(10) } };
  await page.route('**/api/v1/services', route => route.fulfill({ json: [{ ...card, copy: longCopy }] }));
  await page.goto('/fr/');
  await page.getByRole('button', { name: /nécessaire seulement/iu }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const region = page.locator('.swiper-slide-active [data-story-scroll]');
  await expect(region).toHaveAttribute('tabindex', '0');
  await expect(page.locator('.swiper-slide-active .session-story__cta')).toBeInViewport({ ratio: 1 });
  await region.focus();
  await page.keyboard.press('End');
  await expect.poll(() => region.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await assertNoHorizontalOverflow(page);
});

test('About keeps owner alt text, including an explicit decorative choice', async ({ page }) => {
  for (const imageAlt of ['Portrait choisi par le propriétaire', '']) {
    await page.route('**/api/v1/site', route => route.fulfill({ json: { ...ownerSettings,
      aboutCopy: { fr: { title: 'Rencontrez la photographe', body: 'Biographie du propriétaire.', imageAlt },
        en: { title: 'Meet the photographer', body: 'Owner biography.', imageAlt } },
    } }));
    await page.goto('/fr/about');
    await expect(page.locator('.about-page__image img').first()).toHaveAttribute('alt', imageAlt);
    await expect(page.locator('.about-page__story')).toHaveText('Biographie du propriétaire.');
    await expect(page.locator('.about-page__action')).toContainText(immersive ? 'Parlons de votre séance' : 'Contact');
    if (immersive) {
      const photo = page.locator('.about-page__image');
      const biography = page.locator('.about-page__hero-copy');
      await expect(photo.locator('img').first()).toHaveCSS('object-fit', 'contain');
      const photoBox = (await photo.boundingBox())!;
      const textBox = (await biography.boundingBox())!;
      expect(photoBox.width).toBeGreaterThan(page.viewportSize()!.width * 0.3);
      if (page.viewportSize()!.width > 864) {
        expect(photoBox.x + photoBox.width).toBeLessThan(textBox.x);
        expect(Math.abs(photoBox.y + photoBox.height / 2 - textBox.y - textBox.height / 2)).toBeLessThan(1);
      } else {
        expect(photoBox.y + photoBox.height).toBeLessThan(textBox.y);
        expect(textBox.x).toBeCloseTo(photoBox.x, 0);
      }
      await expect(biography.locator('.about-page__story')).toHaveText('Biographie du propriétaire.');
      await assertNoHorizontalOverflow(page);
    }
  }
});
