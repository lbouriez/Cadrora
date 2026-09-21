import { expect, mockGallery, test } from './fixtures';

test('ouvre une galerie publique et sa visionneuse', async ({ page }) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  await expect(page.getByRole('heading', { level: 1, name: 'Mariage Lumiere' })).toBeVisible();
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/photo\/photo-1$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /afficher les informations|show photo information/i }).click();
  await expect(page.getByText('danse-au-coucher-du-soleil.jpg')).toBeVisible();
  await expect(page.getByText('1800 × 1200 px')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
});

test('conserve les resultats IA dans la session et filtre la galerie', async ({ page }) => {
  await mockGallery(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cadrora:face-search:mariage-lumiere', JSON.stringify({
      photoIds: ['photo-1'],
      savedAt: '2026-09-21T18:00:00.000Z',
    }));
  });
  await page.goto('/e/mariage-lumiere?view=matches');

  await expect(page.getByRole('button', { name: /trouvées pour moi|found for me/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' })).toBeVisible();
  await page.getByRole('button', { name: /toutes les photos|all photos/i }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
  await expect(page.getByRole('button', { name: /toutes les photos|all photos/i })).toHaveAttribute('aria-pressed', 'true');
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
