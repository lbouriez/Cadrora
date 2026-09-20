import { expect, mockGallery, test } from './fixtures';

test('ouvre une galerie publique et sa visionneuse', async ({ page }) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  await expect(page.getByRole('heading', { level: 1, name: 'Mariage Lumiere' })).toBeVisible();
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/photo\/photo-1$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
});

test('demande puis echange le mot de passe d une galerie protegee', async ({ page }) => {
  await mockGallery(page, { protected: true });
  await page.goto('/e/soiree-privee');

  await expect(page.getByRole('heading', { name: /galerie est protégée|gallery is protected/i })).toBeVisible();
  await page.getByLabel(/mot de passe de l'événement|event password/i).fill('mot-de-passe');
  await page.getByRole('button', { name: /ouvrir la galerie|open gallery/i }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Soiree privee' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' })).toBeVisible();
});
