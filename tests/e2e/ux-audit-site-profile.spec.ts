import { assertNoHorizontalOverflow, expect, mockGallery, publicEvent, publicPhoto, test } from './fixtures';

const settings = {
  siteName: 'Example Studio', defaultLanguage: 'en', enabledLanguages: ['en', 'fr'],
  contactEmail: 'hello@example.test', contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['family'], themeMode: 'light', analyticsMeasurementId: null,
  galleryDirectoryEnabled: true, homeGalleries: { enabled: false, limit: 6 },
  constructionNoticeEnabled: false, updatedAt: '2026-10-25T00:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadrora-language', 'en'));
  await page.route('**/api/v1/site', (route) => route.fulfill({ json: settings }));
});

test('narrow photo viewer traps keyboard focus without its hidden thumbnail rail', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere/photo/photo-1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.photo-viewer__rail')).toBeHidden();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  const close = dialog.getByRole('button', { name: 'Close photo viewer' });
  const download = dialog.getByRole('link', { name: 'Download' });
  await download.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(download).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('narrow-viewer-focus.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

test('download actions remain visible deep in a gallery without covering the header', async ({ page }, testInfo) => {
  await mockGallery(page);
  await page.route('**/api/v1/galleries/mariage-lumiere/photos*', (route) => route.fulfill({ json: {
    eventRevision: publicEvent.revision, nextCursor: null,
    photos: Array.from({ length: 60 }, (_, index) => ({ ...publicPhoto, id: `photo-${index + 1}`,
      filename: `photo-${index + 1}.jpg`, sortKey: String(index + 1).padStart(8, '0'),
      downloadUrl: `/media/event-1/photo-${index + 1}/2/download` })),
  } }));
  await page.goto('/e/mariage-lumiere');
  const necessary = page.getByRole('button', { name: /necessary only/i });
  if (await necessary.isVisible()) await necessary.click();
  await page.getByRole('button', { name: 'Select photos to download' }).click();
  const photos = page.locator('.photo-tile--selectable');
  await photos.nth(45).click();
  await photos.nth(46).click();
  const toolbar = page.getByRole('region', { name: 'Photo download selection' });
  await expect(toolbar).toBeInViewport();
  await expect(toolbar).toContainText('2 photos selected');
  await expect(toolbar.getByRole('button', { name: 'Create a ZIP of 2 photos' })).toBeEnabled();
  await expect(toolbar.getByRole('button', { name: 'Create a ZIP of 2 photos' })).toBeInViewport({ ratio: 1 });
  const bounds = await toolbar.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect(bounds ? bounds.y + bounds.height : Infinity).toBeLessThan(page.viewportSize()?.height ?? 0);
  if (process.env.CADRORA_SITE === 'atelier-giulia') {
    const header = await page.locator('.public-masthead').boundingBox();
    expect(bounds?.y ?? 0).toBeGreaterThanOrEqual(header ? header.y + header.height : 0);
  }
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('sticky-download-selection.png') });
  await toolbar.getByRole('button', { name: 'Clear selection' }).click();
  await expect(toolbar).toContainText('0 photos selected');
});

test('About text remains unsaved after a portrait upload and survives an internal round trip', async ({ page }, testInfo) => {
  let about = { ...settings, aboutImageRevision: 1,
    aboutCopy: { fr: { title: 'Giulia', body: 'Présentation', imageAlt: '' }, en: { title: 'Giulia', body: 'Introduction', imageAlt: '' } },
    quotaCeilings: { faceLimit: 1000, storageLimitBytes: 1000000000 },
    quotas: { faceLimit: 1000, storageLimitBytes: 1000000000 }, usage: { faces: 0, storageBytes: 0 },
  };
  await page.route('**/about-hero-image/preview*', (route) => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#555"/></svg>' }));
  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) {
      await route.fulfill({ json: { access: 'manage', authMode: 'password', createdAt: '2026-10-25T00:00:00.000Z',
        expiresAt: '2030-10-25T00:00:00.000Z', id: 'session-ux-test', revokedAt: null, subject: 'owner@example.test' } });
    } else if (path.endsWith('/site/about')) {
      const body = route.request().postDataJSON() as { copy: typeof about.aboutCopy };
      about = { ...about, aboutCopy: body.copy };
      await route.fulfill({ json: about });
    } else if (path.endsWith('/site')) await route.fulfill({ json: about });
    else if (path.endsWith('/image-revision')) await route.fulfill({ json: { revision: 2 } });
    else if (path.endsWith('/publish')) {
      about = { ...about, aboutImageRevision: 2 };
      await route.fulfill({ json: { revision: 2 } });
    } else if (route.request().method() === 'PUT') await route.fulfill({ json: { variant: path.split('/').at(-1) } });
    else await route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/admin/login');
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/about');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const introduction = page.getByRole('textbox', { name: 'Introduction · English' });
  await introduction.fill('A new introduction that has not been saved.');
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2560; canvas.height = 1707;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#666'; context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg').split(',')[1] ?? '';
  });
  await page.getByLabel('Photographer portrait', { exact: true }).setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
  await expect(page.getByText('Portrait saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('About page saved.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Text changes are not saved.', { exact: false })).toBeVisible();
  await page.locator('.admin-shell__header').getByRole('link', { name: 'Back to website' }).click();
  await expect(page).toHaveURL('/');
  await page.goBack();
  await expect(introduction).toHaveValue('A new introduction that has not been saved.');
  await page.getByRole('button', { name: 'Save About page' }).click();
  await expect(page.getByText('About page saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Text changes are not saved.', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('about-copy-saved.png') });
});
