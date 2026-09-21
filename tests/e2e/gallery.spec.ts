import { expect, mockGallery, test } from './fixtures';

test('ouvre une galerie publique et sa visionneuse', async ({ page }) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  await expect(page.getByRole('heading', { level: 1, name: 'Mariage Lumiere' })).toBeVisible();
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/photo\/photo-1$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  const closeButton = page.getByRole('button', { name: /fermer la visionneuse|close viewer/i });
  const closeBox = await closeButton.boundingBox();
  const closeIconBox = await closeButton.locator('svg').boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeIconBox).not.toBeNull();
  expect(Math.abs((closeBox?.x ?? 0) + (closeBox?.width ?? 0) / 2 - ((closeIconBox?.x ?? 0) + (closeIconBox?.width ?? 0) / 2))).toBeLessThan(1);
  expect(Math.abs((closeBox?.y ?? 0) + (closeBox?.height ?? 0) / 2 - ((closeIconBox?.y ?? 0) + (closeIconBox?.height ?? 0) / 2))).toBeLessThan(1);
  const nextButton = page.getByRole('button', { name: /photo suivante|next photo/i });
  const nextBeforeHover = await nextButton.boundingBox();
  await expect(nextButton).toHaveCSS('transform', 'none');
  await nextButton.hover();
  const nextAfterHover = await nextButton.boundingBox();
  expect(nextAfterHover).toEqual(nextBeforeHover);
  await expect(nextButton).toHaveCSS('transform', 'none');
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
      matchedPhotos: [{
        capturedAt: '2026-09-20T16:00:00.000Z', momentId: 'ceremony', photoId: 'photo-1', revision: 2, thumbnailUrl: '/e2e/photo-1.svg',
      }],
      nearbyPhotos: [{
        capturedAt: '2026-09-20T16:05:00.000Z', momentId: 'ceremony', photoId: 'photo-2', revision: 2, thumbnailUrl: '/e2e/photo-1.svg',
      }],
      savedAt: '2026-09-21T18:00:00.000Z',
    }));
  });
  await page.goto('/e/mariage-lumiere?view=matches');

  await expect(page.getByRole('button', { name: /trouvées pour moi|found for me/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /correspondances possibles|possible matches/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /moments rapprochés|nearby moments/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'portrait-au-jardin.jpg' })).toBeVisible();
  await page.getByRole('button', { name: /toutes les photos|all photos/i }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
  await expect(page.getByRole('button', { name: /toutes les photos|all photos/i })).toHaveAttribute('aria-pressed', 'true');
});

test('revient aux resultats de recherche apres fermeture de la visionneuse', async ({ page }) => {
  await mockGallery(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cadrora:face-search:mariage-lumiere', JSON.stringify({
      matchedPhotos: [{
        capturedAt: '2026-09-20T16:00:00.000Z', momentId: 'ceremony', photoId: 'photo-1', revision: 2, thumbnailUrl: '/e2e/photo-1.svg',
      }],
      nearbyPhotos: [{
        capturedAt: '2026-09-20T16:05:00.000Z', momentId: 'ceremony', photoId: 'photo-2', revision: 2, thumbnailUrl: '/e2e/photo-1.svg',
      }],
      savedAt: '2026-09-21T18:00:00.000Z',
    }));
  });
  await page.goto('/e/mariage-lumiere/photo/photo-1?view=matches&return=find');
  await page.getByRole('button', { name: /fermer la visionneuse|close viewer/i }).click();

  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/find#face-search-results$/);
  await expect(page.getByRole('heading', { name: /correspondances possibles|possible matches/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /photos de moments rapprochés|photos from nearby moments/i })).toBeVisible();
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
