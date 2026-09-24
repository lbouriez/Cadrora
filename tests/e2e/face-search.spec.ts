import { expect, test } from './fixtures';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('garde la photo locale avant toute recherche faciale', async ({ page }) => {
  const faceApiRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/v1/galleries/') && path.endsWith('/face-search')) faceApiRequests.push(request.url());
  });

  await page.goto('/e/mariage-lumiere/find');
  await expect(page.locator('.face-find__test-links a')).toHaveCount(2);
  await expect(page.locator('.face-find__test-links img')).toHaveCount(2);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({ buffer: tinyPng, mimeType: 'image/png', name: 'selfie.png' });

  await expect(page.getByRole('img', { name: /photo de recherche (?:choisie|sélectionnée)|locally selected search photo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /trouver les visages|find faces/i })).toBeVisible();
  expect(faceApiRequests).toEqual([]);
});
