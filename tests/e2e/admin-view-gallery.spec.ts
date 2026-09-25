import { expect, test } from './fixtures';

const gallery = {
  id: 'private-gallery-1', slug: 'private-gallery', title: 'Private gallery', description: null,
  startsAt: '2030-01-01T00:00:00.000Z', timezone: 'UTC', coverPhotoId: null,
  visibility: 'published', offlineAt: null, deletingAt: null, access: 'protected',
  allowDownloads: false, faceSearchEnabled: false, nearbySearchEnabled: false,
  showPhotoMetadata: false, retouchSelectionEnabled: false, showOnGalleryPage: true,
  keepOriginals: false, storageBytes: 0, photoCount: 0, retentionDays: null, revision: 1,
  createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z',
};

test('owner View gallery opens a protected gallery without the visitor password', async ({ page }) => {
  let grantRequests = 0;
  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        access: 'manage', authMode: 'password', createdAt: gallery.createdAt,
        expiresAt: '2030-01-02T00:00:00.000Z', id: 'owner-session', revokedAt: null, subject: 'owner',
      }) });
    } else if (path.endsWith('/galleries')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: [gallery] }) });
    } else if (path.endsWith('/private-gallery-1/view')) {
      grantRequests += 1;
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers().origin).toBe(new URL(route.request().url()).origin);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ slug: gallery.slug }) });
    } else {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
  });
  await page.route('**/api/v1/galleries/private-gallery', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...gallery, coverPhotoUrl: null }) });
  });
  await page.route('**/api/v1/galleries/private-gallery/photos**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ eventRevision: 1, photos: [], nextCursor: null }) });
  });

  await page.goto('/admin/login');
  await page.evaluate(() => {
    history.pushState({}, '', '/admin');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const row = page.locator('.admin-event-row').filter({ hasText: gallery.title });
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(row.getByRole('button', { name: /view gallery|voir la galerie/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await row.getByRole('button', { name: /view gallery|voir la galerie/i }).click();

  await expect(page).toHaveURL(/\/e\/private-gallery$/u);
  await expect(page.getByRole('heading', { name: gallery.title })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /password|mot de passe/i })).toHaveCount(0);
  expect(grantRequests).toBe(1);
});
