import { expect, test, assertNoHorizontalOverflow } from './fixtures';

for (const language of ['fr', 'en'] as const) {
  test(`disabled Sessions retains Home cards and hides links in ${language}`, async ({ page }) => {
    await page.route('**/api/v1/site', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      siteName: 'Studio', defaultLanguage: language, enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['family'], sessionsPageEnabled: false, analyticsMeasurementId: null, themeMode: 'light',
      homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-10-01T00:00:00.000Z',
    }) }));
    await page.route('**/api/v1/services', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
      id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: { fr: { title: 'Famille', shortDescription: 'Séance famille', description: 'Photos de famille', points: [] },
        en: { title: 'Family', shortDescription: 'Family session', description: 'Family photos', points: [] } },
      imageRevision: null, imageSources: [],
    }]) }));
    await page.goto(`/${language}/`);
    const consent = page.locator('.privacy-consent');
    if (await consent.isVisible()) await consent.getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: language === 'fr' ? 'Famille' : 'Family', exact: true })).toBeVisible();
    await expect(page.locator('a[href$="/services"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    const details = page.getByRole('button', { name: language === 'fr' ? 'Découvrir cette séance' : 'Explore this session', exact: true });
    // Both profile presentations retain their existing detail-dialog action.
    await expect(details).toBeVisible();
    await details.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

for (const language of ['fr', 'en'] as const) {
  test(`Website groups public page switches and saves them in ${language}`, async ({ page }) => {
    await page.addInitScript((lang) => localStorage.setItem('cadrora-language', lang), language);
    let settings = {
      siteName: 'Studio', defaultLanguage: language, enabledLanguages: ['fr', 'en'],
      contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      enabledServices: ['family'], sessionsPageEnabled: true, galleryDirectoryEnabled: true, aboutEnabled: true,
      analyticsMeasurementId: null, themeMode: 'light', homeGalleries: { enabled: false, limit: 6 },
      updatedAt: '2026-10-01T00:00:00.000Z', quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
      quotas: { faceLimit: 10000, storageLimitBytes: 2000000000 }, usage: { faces: 0, storageBytes: 0 },
    };
    await page.route('**/api/v1/site', (route) => route.fulfill({ json: settings }));
    await page.route('**/api/v1/admin/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = [];
      if (path.endsWith('/session')) body = {
        access: 'manage', authMode: 'password', createdAt: '2026-10-01T00:00:00.000Z',
        expiresAt: '2030-10-01T00:00:00.000Z', id: 'test-owner', subject: 'owner', revokedAt: null,
      };
      if (path.endsWith('/site')) {
        if (route.request().method() === 'PATCH') settings = { ...settings, ...route.request().postDataJSON() as Partial<typeof settings> };
        body = settings;
      }
      await route.fulfill({ json: body });
    });
    await page.goto('/admin/login');
    await page.evaluate(() => { history.pushState({}, '', '/admin/settings'); dispatchEvent(new PopStateEvent('popstate')); });
    const group = page.getByRole('group', { name: language === 'fr' ? 'Pages publiques' : 'Public pages', exact: true });
    await expect(group.getByRole('checkbox')).toHaveCount(3);
    await group.scrollIntoViewIfNeeded();
    await assertNoHorizontalOverflow(page);
    for (const checkbox of await group.getByRole('checkbox').all()) await checkbox.uncheck();
    await page.getByRole('button', { name: language === 'fr' ? 'Enregistrer les réglages publics' : 'Save public settings', exact: true }).click();
    await expect.poll(() => [settings.galleryDirectoryEnabled, settings.sessionsPageEnabled, settings.aboutEnabled]).toEqual([false, false, false]);
    await page.evaluate(() => { history.pushState({}, '', '/admin/portfolio'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(group).toHaveCount(0);
    await page.evaluate(() => { history.pushState({}, '', '/admin/settings'); dispatchEvent(new PopStateEvent('popstate')); });
    for (const checkbox of await group.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
  });
}

for (const enabled of [false, true]) {
  test(`optional page links stay hidden during a slow settings load then follow enabled=${enabled}`, async ({ page }) => {
    let release = () => {};
    const ready = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/v1/site', async (route) => {
      await ready;
      await route.fulfill({ json: {
        siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
        contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
        map: { centerLatitude: null, centerLongitude: null, radiusKm: null }, enabledServices: ['family'],
        galleryDirectoryEnabled: enabled, sessionsPageEnabled: enabled, aboutEnabled: enabled,
        analyticsMeasurementId: null, themeMode: 'light', homeGalleries: { enabled: false, limit: 6 },
        updatedAt: '2026-10-01T00:00:00.000Z',
      } });
    });
    const optional = page.locator('a[href$="/services"], a[href$="/about"], a[href="/galleries"]');
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.public-header')).toBeVisible();
      await expect(optional).toHaveCount(0);
      await page.waitForTimeout(2100);
      await expect(optional).toHaveCount(0);
      release();
      await expect(page.locator('.public-brand__name')).toHaveText('Studio');
      if (enabled) {
        await expect(page.locator('.public-nav a[href$="/services"]')).toHaveCount(1);
        await expect(page.locator('.public-nav a[href$="/about"]')).toHaveCount(1);
        // Profiles can omit Galleries from their configured navigation.
        if (process.env.CADRORA_SITE !== 'atelier-giulia') await expect(page.locator('.public-nav a[href="/galleries"]')).toHaveCount(1);
      } else await expect(optional).toHaveCount(0);
    } finally { release(); }
  });
}
