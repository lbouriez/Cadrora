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
  retouchSelectionEnabled: true,
  showOnGalleryPage: true,
  keepOriginals: false,
  retentionDays: null,
  revision: 1,
  createdAt: '2026-09-20T15:00:00.000Z',
  updatedAt: '2026-09-20T15:00:00.000Z',
};

const protectedEvent = {
  ...demoEvent,
  id: 'private-sample', slug: 'private-sample', title: 'Private family gallery',
  access: 'protected', retouchSelectionCount: 1,
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
          contactPhone: '+1 514 555-0142',
          contactAddress: 'Montréal, Québec',
          serviceArea: 'Greater Montréal',
          map: { centerLatitude: 45.5019, centerLongitude: -73.5674, radiusKm: 125 },
          enabledServices: ['wedding', 'family', 'brand', 'corporate', 'children'],
          analyticsMeasurementId: null,
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
    if (path.endsWith('/cover-photos')) {
      await route.fulfill({ body: JSON.stringify({ photos: [{
        id: 'demo-ai-01', filename: 'portrait.webp',
        thumbnailUrl: `/api/v1/admin/galleries/${demoEvent.id}/cover-photos/demo-ai-01`,
      }], nextOffset: null }), contentType: 'application/json' });
      return;
    }
    if (path.endsWith('/cover-photos/demo-ai-01')) {
      await route.fulfill({ body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>', contentType: 'image/svg+xml' });
      return;
    }
    if (path.endsWith('/originals')) {
      await route.fulfill({ body: JSON.stringify({ count: 2, bytes: 800, activeImports: 0, cleanupState: 'idle' }), contentType: 'application/json' });
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
      await route.fulfill({ body: JSON.stringify({ events: [demoEvent, protectedEvent] }), contentType: 'application/json' });
      return;
    }
    await route.fulfill({ body: '{}', contentType: 'application/json', status: 404 });
  });

  await page.goto('/admin/login');
  await page.evaluate(() => {
    history.pushState({}, '', '/admin/settings');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('navigation', { name: /site setting sections|sections des réglages du site/i })).toBeVisible();
  await expect(page.getByRole('group', { name: /website|site web/i })).toBeVisible();
  await expect(page.getByRole('group', { name: /^services$/i })).toBeVisible();
  await expect(page.getByRole('group', { name: /^contact$/i })).toBeVisible();
  await expect(page.getByRole('group', { name: /your site limits|limites de votre site/i })).toBeVisible();
  await page.route('https://photon.komoot.io/api/**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ features: [{
      geometry: { coordinates: [-73.34, 45.59] },
      properties: { name: 'Sainte-Julie', state: 'Québec', country: 'Canada' },
    }] }),
  }));
  await page.getByRole('searchbox', { name: /find a city|rechercher une ville/i }).fill('Sainte-Julie');
  await page.getByRole('button', { name: 'Sainte-Julie, Québec, Canada' }).click();
  await expect(page.getByRole('spinbutton', { name: /centre latitude|latitude du centre/i })).toHaveValue('45.59');
  await expect(page.getByRole('spinbutton', { name: /centre longitude|longitude du centre/i })).toHaveValue('-73.34');
  const analyticsId = page.getByRole('textbox', { name: /google analytics id|identifiant google analytics/i });
  await analyticsId.fill('G-ABCDEF1234');
  await expect(analyticsId).toHaveValue('G-ABCDEF1234');
  const corporateService = page.getByRole('checkbox', { name: /workplace photography|photos d’entreprise/i });
  await corporateService.uncheck();
  await expect(corporateService).not.toBeChecked();
  await corporateService.check();
  const mapRadius = page.getByRole('spinbutton', { name: /travel distance|distance de déplacement/i });
  await mapRadius.fill('150');
  await expect(mapRadius).toHaveValue('150');
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
  const storageLimit = page.getByRole('spinbutton', { name: /maximum space for photos|espace maximal pour les photos/i });
  const faceLimit = page.getByRole('spinbutton', { name: /maximum faces saved|nombre maximal de visages conservés/i });
  await expect(galleryLimit).toHaveValue('10');
  await expect(storageLimit).toHaveValue('2');
  await expect(faceLimit).toHaveValue('10000');
  await expect(page.getByText(/750 MB of 2 GB|750 Mo sur 2 Go/u)).toBeVisible();
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
  await expect(page.locator('input[name="startsAt"]')).toHaveAttribute('type', 'date');
  await expect(page.locator('input[name="startsAt"]')).toHaveValue('2026-09-20');
  const downloads = page.getByRole('checkbox', { name: /allow photo downloads|autoriser le téléchargement des photos/i });
  const originals = page.getByRole('checkbox', { name: /offer original files|proposer les fichiers originaux/i });
  await expect(downloads).not.toBeChecked();
  await expect(originals).toHaveCount(0);
  await downloads.check();
  await expect(originals).toBeVisible();
  await page.getByRole('button', { name: /new imports keep the original|les prochains imports conserveront l’original/i }).click();
  await expect(page.getByRole('tooltip')).toContainText(/visitors receive the best prepared copy|visiteurs recevront la meilleure copie préparée/i);
  await expect(originals).not.toBeChecked();
  await originals.check();
  await downloads.uncheck();
  await expect(originals).toHaveCount(0);
  const faceSearch = page.getByRole('checkbox', { name: /optional face search|recherche faciale facultative/i });
  const nearbySearch = page.getByRole('checkbox', { name: /nearby moments|moments rapprochés/i });
  const showOnGalleryPage = page.getByRole('checkbox', { name: /show in public gallery lists|afficher dans les listes publiques/i });
  await expect(showOnGalleryPage).toBeChecked();
  await showOnGalleryPage.uncheck();
  await expect(showOnGalleryPage).not.toBeChecked();
  await expect(faceSearch).toBeChecked();
  await expect(nearbySearch).toBeChecked();
  await page.getByRole('button', { name: /available with face search|disponible avec la recherche faciale/i }).click();
  await expect(page.getByRole('tooltip')).toContainText(/photos taken just before or after|photos prises juste avant ou après/i);
  await expect(nearbySearch).toBeChecked();
  await faceSearch.uncheck();
  await expect(nearbySearch).not.toBeChecked();
  await expect(nearbySearch).toBeDisabled();
  await faceSearch.check();
  await nearbySearch.check();
  await expect(page.getByRole('button', { name: /save settings|enregistrer les réglages/i })).toBeDisabled();
  await expect(page.getByRole('heading', { name: /gallery cover|couverture de la galerie/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /original files are still stored|fichiers originaux sont encore stockés/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /delete stored originals|supprimer les originaux stockés/i })).toBeDisabled();
  const cover = page.getByRole('button', { name: /use portrait.webp as the gallery cover|utiliser portrait.webp comme couverture/i });
  await cover.click();
  await expect(cover).toHaveAttribute('aria-pressed', 'true');
  const availability = page.getByRole('combobox', { name: /visitor availability|disponibilité pour les visiteurs/i });
  await expect(availability).toBeEnabled();
  await availability.selectOption('offline');
  await expect(page.getByRole('button', { name: /take gallery offline|mettre la galerie hors ligne/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /delete gallery|supprimer la galerie/i })).toBeDisabled();
  await expect(page.getByRole('heading', { level: 1, name: /settings|réglages/i })).toBeVisible();
  const workspaceOrder = await page.locator('.admin-workspace > section').evaluateAll((sections) => sections.map((section) => section.getAttribute('class') ?? ''));
  expect(workspaceOrder).toEqual(expect.arrayContaining(['publish-panel', 'admin-card admin-event-settings', 'admin-card admin-danger-zone']));
  expect(workspaceOrder[0]).toBe('publish-panel');
  await page.setViewportSize({ width: 320, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => {
    history.pushState({}, '', '/admin');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: /your galleries|vos galeries/i })).toBeVisible();
  await expect(page.locator('input[name="startsAt"]')).toHaveAttribute('type', 'date');
  const privateRow = page.locator('.admin-event-row').filter({ hasText: 'Private family gallery' });
  await expect(privateRow.getByRole('link', { name: /client photo choices|choix des clients/i })).toBeVisible();
  await page.setViewportSize({ width: 1200, height: 850 });
  const actionLayout = await privateRow.evaluate((row) => {
    const bounds = row.getBoundingClientRect();
    const actions = row.querySelector('.admin-event-row__actions');
    if (!actions) return { columns: 0, withinCard: false };
    const buttons = [...actions.querySelectorAll('a')];
    return {
      columns: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
      withinCard: buttons.every((button) => {
        const buttonBounds = button.getBoundingClientRect();
        return buttonBounds.left >= bounds.left && buttonBounds.right <= bounds.right;
      }),
    };
  });
  expect(actionLayout).toEqual({ columns: 2, withinCard: true });
  await page.setViewportSize({ width: 320, height: 812 });
  const dashboardOrder = await page.locator('.admin-events > section').evaluateAll((sections) => sections.map((section) => section.getAttribute('class') ?? ''));
  expect(dashboardOrder.slice(0, 2)).toEqual(['admin-card admin-demo-intro', 'admin-card admin-events__list']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate((eventId) => {
    history.pushState({}, '', `/admin/galleries/${eventId}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, protectedEvent.id);
  const retouchSwitch = page.getByRole('checkbox', { name: /select photos for retouching|choisir des photos à retoucher/i });
  await expect(retouchSwitch).toBeChecked();
  await page.getByRole('button', { name: /turn off when retouch requests|désactivez cette option lorsque les demandes/i }).click();
  await expect(page.getByRole('tooltip')).toContainText(/existing selections stay|sélections existantes restent/i);
  await expect(retouchSwitch).toBeChecked();
  await retouchSwitch.uncheck();
  await expect(retouchSwitch).not.toBeChecked();
  await expect(page.getByRole('button', { name: /save settings|enregistrer les réglages/i })).toBeDisabled();
  expect(writes).toEqual([]);
});
