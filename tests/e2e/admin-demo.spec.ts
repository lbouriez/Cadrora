import { expect, test } from './fixtures';

const demoEvent = {
  id: 'demo-ai-face-search',
  slug: 'find-your-photos',
  title: 'Find your photos',
  description: 'Face search demonstration',
  startsAt: '2026-09-20T15:00:00.000Z',
  timezone: 'America/Toronto',
  coverPhotoId: null,
  visibility: 'published',
  offlineAt: null,
  deletingAt: null,
  access: 'public',
  allowDownloads: false,
  faceSearchEnabled: true,
  nearbySearchEnabled: true,
  showPhotoMetadata: true,
  keepOriginals: false,
  retentionDays: null,
  revision: 1,
  createdAt: '2026-09-20T15:00:00.000Z',
  updatedAt: '2026-09-20T15:00:00.000Z',
};

test('la demo admin laisse explorer les reglages sans autoriser les ecritures', async ({ page }) => {
  const writes: string[] = [];
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path.endsWith('/session')) {
      await route.fulfill({
        body: JSON.stringify({
          access: 'read-only',
          authMode: 'demo',
          createdAt: '2026-09-20T15:00:00.000Z',
          expiresAt: '2026-09-20T23:00:00.000Z',
          id: 'demo-session-e2e',
          revokedAt: null,
          subject: 'demo',
        }),
        contentType: 'application/json',
      });
      return;
    }
    if (path.endsWith('/site')) {
      await route.fulfill({
        body: JSON.stringify({
          siteName: 'Cadrora',
          defaultLanguage: 'en',
          enabledLanguages: ['en', 'fr'],
          contactEmail: 'hello@example.test',
          themeMode: 'both',
          quotaCeilings: { faceLimit: 39000, galleryLimit: 50, storageLimitBytes: 9900000000 },
          quotas: { faceLimit: 10000, galleryLimit: 10, storageLimitBytes: 2000000000 },
          usage: { faces: 420, galleries: 3, storageBytes: 750000000 },
          updatedAt: '2026-09-20T15:00:00.000Z',
        }),
        contentType: 'application/json',
      });
      return;
    }
    if (path.endsWith('/publication')) {
      await route.fulfill({
        body: JSON.stringify({
          eventId: demoEvent.id,
          indexingPhotos: 0,
          offlineAt: null,
          publishedAt: '2026-09-20T15:00:00.000Z',
          publishedPhotos: 10,
          readyPhotos: 10,
          totalPhotos: 10,
          visibility: 'published',
        }),
        contentType: 'application/json',
      });
      return;
    }
    if (path.endsWith('/galleries')) {
      await route.fulfill({ body: JSON.stringify({ events: [demoEvent] }), contentType: 'application/json' });
      return;
    }
    await route.fulfill({ body: '{}', contentType: 'application/json', status: 404 });
  });

  await page.goto('/admin/login');
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/settings');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const language = page.getByRole('combobox', { name: /default visitor language|langue visiteur par défaut/i });
  const theme = page.getByRole('combobox', { name: /visitor colour theme|thème de couleur visiteur/i });
  await page.locator('.multi-select__summary').click();
  const frenchLanguage = page.getByRole('checkbox', { name: /french|français/i });
  await expect(language).toBeEnabled();
  await expect(theme).toBeEnabled();
  await expect(frenchLanguage).toBeChecked();
  await frenchLanguage.uncheck();
  await expect(frenchLanguage).not.toBeChecked();
  await frenchLanguage.check();
  await language.selectOption('fr');
  await theme.selectOption('system');
  await expect(language).toHaveValue('fr');
  await expect(theme).toHaveValue('system');
  const galleryLimit = page.getByRole('spinbutton', { name: /maximum separate galleries|nombre maximal de galeries distinctes/i });
  const storageLimit = page.getByRole('spinbutton', { name: /maximum media storage|stockage média maximal/i });
  const faceLimit = page.getByRole('spinbutton', { name: /maximum indexed faces|nombre maximal de visages indexés/i });
  await expect(galleryLimit).toHaveValue('10');
  await expect(storageLimit).toHaveValue('2');
  await expect(faceLimit).toHaveValue('10000');
  await galleryLimit.fill('8');
  await storageLimit.fill('1.5');
  await faceLimit.fill('5000');
  await expect(galleryLimit).toHaveValue('8');
  await expect(storageLimit).toHaveValue('1.5');
  await expect(faceLimit).toHaveValue('5000');
  await expect(page.getByRole('button', { name: /save public settings|enregistrer les réglages publics/i })).toBeDisabled();
  await expect(page.locator('.admin-shell__controls').getByRole('button')).toHaveCount(1);

  await page.evaluate((eventId) => {
    history.pushState({}, '', `/admin/galleries/${eventId}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, demoEvent.id);
  const faceSearch = page.getByRole('checkbox', { name: /optional face search|recherche faciale facultative/i });
  const nearbySearch = page.getByRole('checkbox', { name: /nearby moments|moments rapprochés/i });
  await expect(faceSearch).toBeChecked();
  await expect(nearbySearch).toBeChecked();
  await faceSearch.uncheck();
  await expect(nearbySearch).not.toBeChecked();
  await expect(nearbySearch).toBeDisabled();
  await faceSearch.check();
  await nearbySearch.check();
  await expect(page.getByRole('button', { name: /save settings|enregistrer les réglages/i })).toBeDisabled();
  const availability = page.getByRole('combobox', { name: /visitor availability|disponibilité pour les visiteurs/i });
  await expect(availability).toBeEnabled();
  await availability.selectOption('offline');
  await expect(page.getByRole('button', { name: /take gallery offline|mettre la galerie hors ligne/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /delete gallery|supprimer la galerie/i })).toBeDisabled();
  expect(writes).toEqual([]);
});
