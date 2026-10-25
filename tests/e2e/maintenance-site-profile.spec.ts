import { assertNoHorizontalOverflow, expect, test } from './fixtures';

const timestamp = '2026-10-25T14:00:00.000Z';
for (const language of ['en', 'fr'] as const) {
  test(`owner maintenance sections remain bounded and understandable in ${language}`, async ({ page }, testInfo) => {
    const calls: string[] = [];
    await page.addInitScript((lang) => localStorage.setItem('cadrora-language', lang), language);
    await page.route('**/api/v1/admin/**', async (route) => {
      const url = new URL(route.request().url());
      calls.push(`${url.pathname}${url.search}`);
      if (url.pathname.endsWith('/session')) return route.fulfill({ json: {
        id: 'owner-session', subject: 'owner', access: 'manage', authMode: 'password',
        createdAt: timestamp, expiresAt: '2030-10-25T00:00:00.000Z', revokedAt: null,
      } });
      if (url.pathname.endsWith('/overview')) return route.fulfill({ json: {
        observedAt: timestamp, retentionDays: 90, lastRun: null, lastSuccessAt: null,
        counts: { pending: 2, running: 1, failed: 1, completed: 12, staleRunning: 1 },
      } });
      if (url.pathname.endsWith('/jobs')) return route.fulfill({ json: { jobs: [{
        id: 'job-failed', kind: 'delete_photo_media', state: 'failed', attempts: 5,
        availableAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
        galleryId: 'gallery-1', hasError: true, leaseExpired: false,
      }], nextCursor: null } });
      if (url.pathname.endsWith('/logs')) return route.fulfill({ json: { logs: [{
        id: 1, occurredAt: timestamp, level: 'warn', source: 'maintenance',
        code: 'MAINTENANCE_OPERATION_FAILED', category: 'maintenance',
        requestId: 'request-safe-reference-1234567890', method: 'SCHEDULED', routeGroup: 'maintenance',
        jobId: 'job-failed', jobKind: 'delete_photo_media',
      }], nextBefore: null, retentionDays: 90 } });
      if (url.pathname.endsWith('/diagnostics/media')) return route.fulfill({ json: {
        scanned: 100, untracked: [], nextCursor: null,
        pendingCleanupJobs: 2, runningCleanupJobs: 1, failedCleanupJobs: 1,
      } });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto('/admin/login');
    await page.evaluate(() => { history.pushState({}, '', '/admin/maintenance'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page.getByRole('heading', { name: 'Maintenance', exact: true })).toBeVisible();
    await expect(page.getByText(/No run recorded yet|Aucune exécution enregistrée/)).toBeVisible();
    expect(calls.some((path) => path.includes('/logs') || path.includes('/jobs') || path.includes('/diagnostics/media'))).toBe(false);
    await assertNoHorizontalOverflow(page);
    await page.locator('.maintenance-section').screenshot({ path: testInfo.outputPath(`maintenance-overview-${language}.png`) });
    const nav = page.getByRole('navigation', { name: /Maintenance sections|Sections de maintenance/ });
    await nav.getByRole('link', { name: /Background jobs|Tâches en arrière-plan/ }).click();
    await expect(page.getByText(/Automatic attempts exhausted|Tentatives automatiques épuisées/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Open gallery settings|Ouvrir les réglages de la galerie/ })).toHaveAttribute('href', '/admin/galleries/gallery-1');
    await page.getByRole('combobox', { name: /Status|État/ }).selectOption('failed');
    await expect.poll(() => calls.some((path) => path.includes('state=failed'))).toBe(true);
    await assertNoHorizontalOverflow(page);
    await page.locator('.maintenance-section').screenshot({ path: testInfo.outputPath(`maintenance-jobs-${language}.png`) });
    await nav.getByRole('link', { name: /Application logs|Journal de l’application/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('MAINTENANCE_OPERATION_FAILED', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: /Severity|Gravité/ }).selectOption('warn');
    await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('maintenance');
    await expect.poll(() => calls.some((path) => path.includes('level=warn') && path.includes('source=maintenance'))).toBe(true);
    await assertNoHorizontalOverflow(page);
    await page.locator('.maintenance-section').screenshot({ path: testInfo.outputPath(`maintenance-logs-${language}.png`) });
    await nav.getByRole('link', { name: /Media checks|Vérification des médias/ }).click();
    expect(calls.some((path) => path.includes('/diagnostics/media'))).toBe(false);
    await page.getByRole('button', { name: /Scan galleries|Analyser les galeries/ }).click();
    await expect.poll(() => calls.filter((path) => path.includes('/diagnostics/media')).length).toBe(1);
    await expect(page.getByText(/Scanned 100 objects|100 objets analysés/)).toBeVisible();
  });
}

test('maintenance denies demo access without fetching owner data, and retains old diagnostics links', async ({ page }) => {
  const calls: string[] = [];
  await page.addInitScript(() => localStorage.setItem('cadrora-language', 'en'));
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    return route.fulfill({ json: { id: 'demo-session', subject: 'demo', access: 'read-only', authMode: 'demo',
      createdAt: timestamp, expiresAt: '2030-10-25T00:00:00.000Z', revokedAt: null } });
  });
  await page.goto('/admin/login');
  await page.evaluate(() => { history.pushState({}, '', '/admin/diagnostics'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page).toHaveURL(/\/admin\/maintenance\?section=logs/);
  await expect(page.getByRole('alert')).toHaveText('Maintenance is available only to the owner.');
  expect(calls.some((path) => path.includes('/maintenance/') || path.includes('/diagnostics/media'))).toBe(false);
  await expect(page.getByRole('link', { name: 'Maintenance', exact: true })).toHaveCount(0);
});

test('unavailable maintenance data is shown as an error rather than a healthy empty state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadrora-language', 'en'));
  await page.route('**/api/v1/admin/**', (route) => new URL(route.request().url()).pathname.endsWith('/session')
    ? route.fulfill({ json: { id: 'owner', subject: 'owner', access: 'manage', authMode: 'password', createdAt: timestamp,
      expiresAt: '2030-10-25T00:00:00.000Z', revokedAt: null } })
    : route.fulfill({ status: 503, json: {} }));
  await page.goto('/admin/login');
  await page.evaluate(() => { history.pushState({}, '', '/admin/maintenance?section=logs'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('alert')).toHaveText('Could not load this section. Try again.');
  await expect(page.getByText('No recorded events match these filters.', { exact: false })).toHaveCount(0);
});
