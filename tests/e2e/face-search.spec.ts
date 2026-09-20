import { expect, test } from './fixtures';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('garde la photo locale avant toute recherche faciale', async ({ page }) => {
  const faceApiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('face-search')) faceApiRequests.push(request.url());
  });

  await page.goto('/e/mariage-lumiere/find');
  const fileInput = page.locator('input[type="file"]').nth(1);
  await expect(fileInput).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({ buffer: tinyPng, mimeType: 'image/png', name: 'selfie.png' });

  await expect(page.getByRole('img', { name: /photo de recherche sélectionnée|locally selected search photo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /trouver les visages|find faces/i })).toBeVisible();
  expect(faceApiRequests).toEqual([]);
});
