import { expect, test, assertNoHorizontalOverflow } from './fixtures';

test.skip(process.env.CADRORA_SITE === 'atelier-giulia', 'Editorial presentation is selected by the Cadrora profile.');

const ownerSettings = {
  siteName: 'Mon studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'dark',
  galleryDirectoryEnabled: false, sessionsPageEnabled: false, aboutEnabled: false,
  homeGalleries: { enabled: false, limit: 6 }, homeHeroImageRevision: 7,
  homeHeroCopy: {
    fr: { label: 'Mon univers', title: 'Une présentationpersonnalisée de mon travail', description: 'Mon texte de présentation.', caption: '', imageAlt: 'Ma photographie' },
    en: { label: 'My world', title: 'A personalphotographicperspective', description: 'My introduction.', caption: '', imageAlt: 'My photograph' },
    buttons: [{ labels: { fr: 'Discutons de votre projet', en: 'Tell me about your project' }, href: '/contact', variant: 'primary' }],
  },
  updatedAt: '2026-11-02T00:00:00.000Z',
};

test('owner settings gate photos and retain localized actions, all Home sessions and page switches', async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on('request', request => {
    if (/\/(?:home-hero-image|service-media)\//u.test(request.url())) mediaRequests.push(new URL(request.url()).pathname);
  });
  let release = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/site', async route => {
    await waiting;
    await route.fulfill({ json: ownerSettings });
  });
  await page.route('**/api/v1/services', route => route.fulfill({ json: Array.from({ length: 6 }, (_, index) => ({
    id: `custom-${index}`, isBuiltin: false, sortOrder: index, enabled: index !== 4, showOnHome: index !== 5,
    imageRevision: null, imageSources: [],
    copy: {
      fr: { title: `Séance ${index}`, shortDescription: 'Mon résumé', description: 'Ma séance', points: [] },
      en: { title: `Session ${index}`, shortDescription: 'My summary', description: 'My session', points: [] },
    },
  })) }));
  await page.route('**/service-media/home-hero/7/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853"><rect width="1280" height="853" fill="#aaa"/></svg>',
  }));
  try {
    await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.site-startup')).toBeVisible();
    expect(mediaRequests).toEqual([]);
  } finally { release(); }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ownerSettings.homeHeroCopy.fr.title);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.site-hero .site-actions a')).toHaveCount(1);
  await expect(page.locator('.site-hero .site-actions a')).toHaveAttribute('href', '/fr/contact');
  await expect(page.locator('.service-card h3')).toHaveText(['Séance 0', 'Séance 1', 'Séance 2', 'Séance 3', 'Séance 4']);
  // A Home-only session is intentionally retained even when its dedicated page is disabled.
  await expect(page.locator('.public-nav a[href$="/services"], .public-nav a[href$="/about"], .public-nav a[href="/galleries"]')).toHaveCount(0);
  await expect(page.locator('#demo, #galleries')).toHaveCount(0);
  expect(mediaRequests.some(path => path.startsWith('/home-hero-image/'))).toBe(false);
  await assertNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
  await page.locator('.public-skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#public-content')).toBeFocused();
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ownerSettings.homeHeroCopy.en.title);
  await expect(page.locator('.site-hero .site-actions a')).toHaveAccessibleName('Tell me about your project');
  await assertNoHorizontalOverflow(page);
});

test('first-visit actions remain above the privacy notice on short phones in both languages', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.route('**/api/v1/site', route => route.fulfill({ json: {
    ...ownerSettings, siteName: 'Cadrora', homeHeroCopy: null, homeHeroImageRevision: null,
    galleryDirectoryEnabled: true, themeMode: 'light',
  } }));
  await page.route('**/api/v1/services', route => route.fulfill({ status: 503 }));
  for (const language of ['fr', 'en']) {
    await page.goto(`/${language}/`);
    await expect(page.locator('.site-startup')).toHaveCount(0);
    const actions = await page.locator('.site-hero .site-actions').boundingBox();
    const notice = await page.locator('.privacy-consent').boundingBox();
    expect(actions).not.toBeNull();
    expect(notice).not.toBeNull();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(notice!.y);
    await assertNoHorizontalOverflow(page);
  }
});
