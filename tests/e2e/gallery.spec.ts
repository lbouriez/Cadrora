import { expect, mockGallery, test } from './fixtures';

test('ouvre une galerie publique et sa visionneuse', async ({ page }) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  await expect(page.getByRole('heading', { level: 1, name: 'Mariage Lumiere' })).toBeVisible();
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/photo\/photo-1$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /télécharger|download/i })).toHaveAttribute('href', '/media/event-1/photo-1/2/download');
  await dialog.evaluate(async (element) => Promise.all(element.getAnimations().map(async (animation) => animation.finished)));
  const desktopDialogBox = await dialog.boundingBox();
  expect(desktopDialogBox?.x).toBeGreaterThan(16);
  expect(desktopDialogBox?.y).toBeGreaterThan(16);
  expect(desktopDialogBox?.width).toBeLessThan(1_440);
  expect(desktopDialogBox?.height).toBeLessThan(900);
  await expect(dialog).not.toHaveCSS('border-radius', '0px');
  await expect(page.locator('.modal-backdrop--photo-viewer')).not.toHaveCSS('backdrop-filter', 'none');
  const closeButton = page.getByRole('button', { name: /fermer la visionneuse|close viewer/i });
  const closeBox = await closeButton.boundingBox();
  const closeIconBox = await closeButton.locator('svg').boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeIconBox).not.toBeNull();
  expect(Math.abs((closeBox?.x ?? 0) + (closeBox?.width ?? 0) / 2 - ((closeIconBox?.x ?? 0) + (closeIconBox?.width ?? 0) / 2))).toBeLessThan(1);
  expect(Math.abs((closeBox?.y ?? 0) + (closeBox?.height ?? 0) / 2 - ((closeIconBox?.y ?? 0) + (closeIconBox?.height ?? 0) / 2))).toBeLessThan(1);
  const nextButton = page.getByRole('button', { name: /photo suivante|next photo/i });
  const nextBeforeHover = await nextButton.boundingBox();
  expect(nextBeforeHover?.width).toBe(44);
  expect(nextBeforeHover?.height).toBe(44);
  await expect(nextButton).toHaveCSS('transform', 'none');
  await nextButton.hover();
  const nextAfterHover = await nextButton.boundingBox();
  expect(nextAfterHover).toEqual(nextBeforeHover);
  await expect(nextButton).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: /afficher les informations|show photo information/i }).click();
  await expect(page.getByText('danse-au-coucher-du-soleil.jpg')).toBeVisible();
  const capturedAt = dialog.locator('dt', { hasText: /prise de vue|captured/i }).locator('..').locator('dd');
  await expect(capturedAt).toContainText(/20.*2026.*12:00:00.*(?:UTC.?4|EDT)/i);
  await expect(page.getByText('1800 × 1200 px')).toBeVisible();
  await page.setViewportSize({ height: 844, width: 390 });
  const mobileDialogBox = await dialog.boundingBox();
  expect(mobileDialogBox).toEqual({ height: 844, width: 390, x: 0, y: 0 });
  await expect(dialog).toHaveCSS('border-radius', '0px');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
});

test('selectionne des photos et cree le ZIP de secours avec un bouton retour entier', async ({ page }, testInfo) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  const backHome = page.locator('.gallery-heading .gallery-back');
  await expect(backHome).toBeVisible();
  await expect(backHome).toHaveAccessibleName(/retour à l'accueil|back to home/i);
  expect(await backHome.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe('1px');
  await page.screenshot({ path: testInfo.outputPath('gallery-header.png') });

  await page.getByRole('button', { name: /sélectionner des photos|select photos to download/i }).click();
  await page.getByRole('button', { name: /sélectionner les photos téléchargeables visibles|select visible downloadable photos/i }).click();
  await expect(page.getByRole('button', { name: /sélectionner danse-au-coucher-du-soleil|select danse-au-coucher-du-soleil/i })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /créer un ZIP|create a ZIP/i }).click();
  await expect(page.getByRole('link', { name: /enregistrer le ZIP|save ZIP/i })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /enregistrer le ZIP|save ZIP/i }).click();
  expect((await download).suggestedFilename()).toBe('mariage-lumiere-photos.zip');
});

test('propose le ZIP apres un dossier refuse par le navigateur', async ({ page }, testInfo) => {
  await mockGallery(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.reject(new DOMException('This folder contains system files', 'AbortError')),
    });
  });
  await page.goto('/e/mariage-lumiere');

  await page.getByRole('button', { name: /sélectionner des photos|select photos to download/i }).click();
  await page.getByRole('button', { name: /sélectionner les photos téléchargeables visibles|select visible downloadable photos/i }).click();
  await page.getByRole('button', { name: /enregistrer 2 photos séparément|save 2 separate photos/i }).click();
  await expect(page.getByRole('alert')).toContainText(/aucun dossier accessible en écriture|no writable folder was selected/i);
  await page.screenshot({ path: testInfo.outputPath('folder-rejected.png') });
  await page.getByRole('button', { name: /créer un ZIP|create a ZIP/i }).click();
  await expect(page.getByRole('link', { name: /enregistrer le ZIP|save ZIP/i })).toBeVisible();
});

test('enregistre deux fichiers séparés dans un sous-dossier choisi', async ({ page }) => {
  await mockGallery(page);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __cadroraWritten?: string[] };
    testWindow.__cadroraWritten = [];
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({
        getDirectoryHandle: () => Promise.resolve({
          getFileHandle: (filename: string) => Promise.resolve({
            createWritable: () => Promise.resolve(new WritableStream<Uint8Array>({
              write: (chunk) => { testWindow.__cadroraWritten?.push(`${filename}:${chunk.byteLength}`); },
            })),
          }),
          removeEntry: () => Promise.resolve(),
        }),
      }),
    });
  });
  await page.goto('/e/mariage-lumiere');

  await page.getByRole('button', { name: /sélectionner des photos|select photos to download/i }).click();
  await page.getByRole('button', { name: /sélectionner les photos téléchargeables visibles|select visible downloadable photos/i }).click();
  await page.getByRole('button', { name: /enregistrer 2 photos séparément|save 2 separate photos/i }).click();
  await expect(page.getByRole('status')).toContainText(/2 photos enregistrées|2 photos saved/i);
  expect(await page.evaluate(() => (window as Window & { __cadroraWritten?: string[] }).__cadroraWritten)).toEqual([
    'danse-au-coucher-du-soleil-photo-1.webp:16',
    'portrait-au-jardin-photo-2.webp:16',
  ]);
});

test('selectionne une plage avec Maj et toutes les photos disponibles avec Ctrl+A', async ({ page }, testInfo) => {
  await mockGallery(page, { withUnavailablePhoto: true });
  await page.goto('/e/mariage-lumiere');

  await page.getByRole('button', { name: /nécessaire seulement|essential only/i }).click();

  await page.getByRole('button', { name: /sélectionner des photos|select photos to download/i }).click();
  const unavailable = page.getByRole('button', { name: /portrait-au-jardin.jpg n’est pas disponible|portrait-au-jardin.jpg is not available/i });
  await unavailable.click();
  await expect(page.getByText(/2 photos visibles sur 3|2 of 3 visible photos/i)).toBeVisible();
  const help = page.getByRole('button', { name: /pourquoi certaines photos|why are some photos/i });
  await help.click();
  await expect(page.getByText(/2 photos visibles sur 3|2 of 3 visible photos/i)).toBeHidden();
  await help.click();
  await expect(page.getByText(/2 photos visibles sur 3|2 of 3 visible photos/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('selection-help.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(help).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('selection-help-mobile.png') });
  await help.click();
  await expect(page.getByText(/2 photos visibles sur 3|2 of 3 visible photos/i)).toBeHidden();

  await page.getByRole('button', { name: /sélectionner danse-au-coucher-du-soleil|select danse-au-coucher-du-soleil/i }).click();
  await page.getByRole('button', { name: /sélectionner portrait-a-la-fete|select portrait-a-la-fete/i }).click({ modifiers: ['Shift'] });
  await expect(page.getByText(/2 photos sélectionnées|2 photos selected/i)).toBeVisible();
  await expect(unavailable).toBeEnabled();
  await page.getByRole('button', { name: /effacer la sélection|clear selection/i }).click();
  await expect(page.getByText(/0 photos sélectionnées|0 photos selected/i)).toBeVisible();
  await page.keyboard.press('Control+A');
  await expect(page.getByText(/2 photos sélectionnées|2 photos selected/i)).toBeVisible();
  await page.getByRole('button', { name: /terminer la sélection|finish selecting/i }).click();
  await expect(page.getByRole('link', { name: 'portrait-au-jardin.jpg' })).toBeVisible();
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
  await page.getByLabel(/mot de passe de la galerie|gallery password/i).fill('mot-de-passe');
  await page.getByRole('button', { name: /ouvrir la galerie|open gallery/i }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Soiree privee' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' })).toBeVisible();
});
