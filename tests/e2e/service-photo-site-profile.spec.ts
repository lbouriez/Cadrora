import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const siteSettings = {
  siteName: 'Photo studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['maternity'], homeGalleries: { enabled: false, limit: 6 },
  analyticsMeasurementId: null, themeMode: 'light', updatedAt: '2026-09-30T00:00:00.000Z',
};

function session() {
  return { id: 'maternity', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
    copy: {
      fr: { title: 'Maternité', shortDescription: 'La beauté de devenir mère', description: 'Une séance personnelle', points: [] },
      en: { title: 'Maternity', shortDescription: 'The beauty of becoming a mother', description: 'A personal session', points: [] },
    }, imageRevision: 1,
    imageSources: [{ url: '/service-media/maternity/1/preview', width: 320, height: 320 },
      { url: '/service-media/maternity/1/large', width: 1280, height: 1280 }],
    photoAlignment: 'center' as 'left' | 'center' | 'right' | 'top' | 'bottom',
    mobilePhotoAlignment: null as 'left' | 'center' | 'right' | 'top' | 'bottom' | null,
  };
}

test('session framing follows the phone override and uses the same crop for both image layers', async ({ page }) => {
  let card = session();
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(siteSettings) }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify([card]) }));
  await page.route('**/service-media/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280"><rect width="1280" height="1280" fill="#aaa"/><circle cx="1060" cy="360" r="130" fill="#222"/></svg>',
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services');
  await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
  const photos = page.locator('.service-photo img');
  await expect(photos).toHaveCount(2);
  for (const image of await photos.all()) {
    await expect(image).toHaveCSS('object-fit', 'cover');
    await expect(image).toHaveCSS('object-position', '50% 50%');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '50% 50%');
  card = { ...card, photoAlignment: 'left', mobilePhotoAlignment: 'right' };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(photos).toHaveCount(2);
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '0% 50%');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '100% 50%');
  await assertNoHorizontalOverflow(page);
  card = { ...card, photoAlignment: 'top', mobilePhotoAlignment: 'bottom' };
  await page.reload();
  await expect(photos).toHaveCount(2);
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '50% 100%');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '50% 0%');
  await page.setViewportSize({ width: 390, height: 844 });
  card = { ...card, photoAlignment: 'left', mobilePhotoAlignment: null };
  await page.reload();
  await expect(photos).toHaveCount(2);
  for (const image of await photos.all()) await expect(image).toHaveCSS('object-position', '0% 50%');
  if (process.env.CADRORA_SITE === 'atelier-giulia') {
    card = { ...card, mobilePhotoAlignment: 'right' };
    await page.goto('/');
    const homePhotos = page.locator('.session-story__photo img');
    await expect(homePhotos).toHaveCount(2);
    for (const image of await homePhotos.all()) await expect(image).toHaveCSS('object-position', '100% 50%');
    await page.setViewportSize({ width: 320, height: 700 });
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const image of await homePhotos.all()) await expect(image).toHaveCSS('object-position', '0% 50%');
  }
});

test('owner can preview and save a phone focal point without another image upload', async ({ page }, testInfo) => {
  const english = testInfo.project.name === 'mobile-chromium';
  if (english) await page.addInitScript(() => localStorage.setItem('cadrora-language', 'en'));
  let card = session();
  const writes: string[] = [];
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(siteSettings) }));
  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes.push(path);
    let body: unknown = [];
    if (path.endsWith('/session')) body = {
      access: 'manage', authMode: 'password', createdAt: '2026-09-30T00:00:00.000Z',
      expiresAt: '2030-09-30T00:00:00.000Z', id: 'test-owner', subject: 'owner', revokedAt: null,
    };
    if (path.endsWith('/site')) body = { ...siteSettings,
      quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
      quotas: { faceLimit: 10000, storageLimitBytes: 2000000000 }, usage: { faces: 0, storageBytes: 0 },
    };
    if (path.endsWith('/services')) body = [card];
    if (path.endsWith('/services/maternity')) {
      const update = route.request().postDataJSON() as ReturnType<typeof session>;
      card = { ...card, ...update }; body = card;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/service-media/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280"><rect width="1280" height="1280" fill="#aaa"/><circle cx="1060" cy="360" r="130" fill="#222"/></svg>',
  }));
  // Use the local SPA route after the mocked owner-session check; no real auth bypass is shipped.
  await page.goto('/admin/login');
  await page.evaluate(() => { history.pushState({}, '', '/admin/settings'); dispatchEvent(new PopStateEvent('popstate')); });
  const editor = page.locator('.admin-service-catalog .admin-service-editor');
  await editor.locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(editor).toHaveAttribute('open', '');
  const mobile = page.getByLabel(english ? 'Phone focal point' : 'Point d’ancrage sur téléphone', { exact: true });
  await expect(mobile).toHaveValue('');
  await page.getByLabel(english ? 'Default focal point' : 'Point d’ancrage par défaut', { exact: true }).selectOption('top');
  await mobile.selectOption('bottom');
  const preview = page.locator('.session-story--preview');
  await expect(preview.locator('img')).toHaveCount(2);
  for (const image of await preview.locator('img').all()) await expect(image).toHaveCSS('object-position', '50% 100%');
  await expect(preview.getByRole('heading')).toHaveText(english ? 'Maternity' : 'Maternité');
  await preview.scrollIntoViewIfNeeded();
  const box = await preview.boundingBox();
  expect((box?.height ?? 0) / (box?.width ?? 1)).toBeCloseTo(844 / 390, 2);
  const heading = await preview.getByRole('heading').boundingBox();
  expect(heading?.width ?? Infinity).toBeLessThanOrEqual(box?.width ?? 0);
  const fontSize = await preview.getByRole('heading').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeLessThanOrEqual((box?.width ?? 0) * 0.13);
  await assertNoHorizontalOverflow(page);
  await preview.screenshot({ path: testInfo.outputPath('phone-preview.png') });
  await page.getByRole('button', { name: english ? 'Save session' : 'Enregistrer la séance', exact: true }).click();
  await expect.poll(() => card.mobilePhotoAlignment).toBe('bottom');
  expect(card.photoAlignment).toBe('top');
  expect(writes).toEqual(['/api/v1/admin/services/maternity']);
  await page.goto('/admin/login');
  await page.evaluate(() => { history.pushState({}, '', '/admin/settings'); dispatchEvent(new PopStateEvent('popstate')); });
  await editor.locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(editor).toHaveAttribute('open', '');
  await expect(mobile).toHaveValue('bottom');
});


test('Home-only session stays public on Home and Contact and is absent from Sessions', async ({ page }) => {
  const card = { ...session(), enabled: false };
  await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...siteSettings, sessionsPageEnabled: true }) }));
  await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify([card]) }));
  await page.route('**/service-media/**', (route) => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853"><rect width="1280" height="853" fill="#aaa"/></svg>',
  }));
  await page.goto('/fr/');
  await page.getByRole('button', { name: /nécessaire seulement|necessary only/i }).click();
  await expect(page.getByRole('heading', { name: 'Maternité', exact: true })).toBeVisible();
  await page.goto('/fr/contact?session=maternity');
  await expect(page.locator('.contact-page__session')).toContainText('Maternité');
  await page.goto('/fr/services');
  await expect(page.locator('.service-detail-card')).toHaveCount(0);
});
