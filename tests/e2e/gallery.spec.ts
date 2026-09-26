import { expect, mockGallery, publicEvent, publicPhoto, test } from './fixtures';

test('demande les photos sans attendre les details de la galerie', async ({ page }) => {
  await mockGallery(page);
  let releaseDetails: () => void = () => {};
  const detailsGate = new Promise<void>((resolve) => { releaseDetails = resolve; });
  let photoRequestStarted = false;
  await page.route('**/api/v1/galleries/mariage-lumiere', async (route) => {
    await detailsGate;
    await route.fulfill({ body: JSON.stringify(publicEvent), contentType: 'application/json' });
  });
  await page.route('**/api/v1/galleries/mariage-lumiere/photos*', async (route) => {
    photoRequestStarted = true;
    await route.fulfill({ body: JSON.stringify({ eventRevision: publicEvent.revision, nextCursor: null, photos: [publicPhoto] }), contentType: 'application/json' });
  });

  await page.goto('/e/mariage-lumiere', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => photoRequestStarted).toBe(true);
  releaseDetails();
  await expect(page.locator('.photo-tile')).toHaveCount(1);
});

test('charge les pages et choisit les variantes selon la largeur sans répéter la couverture', async ({ page }) => {
  await mockGallery(page);
  const photoRequests: string[] = [];
  let pageRequests = 0;
  await page.route('**/api/v1/galleries/mariage-lumiere', async (route) => {
    await route.fulfill({ body: JSON.stringify({ ...publicEvent, coverPhotoUrl: '/media/event-1/photo-1/2/medium' }), contentType: 'application/json' });
  });
  await page.route('**/api/v1/galleries/mariage-lumiere/photos*', async (route) => {
    pageRequests += 1;
    const next = new URL(route.request().url()).searchParams.has('cursor');
    const indexes = next ? [41] : Array.from({ length: 40 }, (_, index) => index + 1);
    await route.fulfill({ body: JSON.stringify({
      eventRevision: publicEvent.revision,
      nextCursor: next ? null : 'next-page',
      photos: indexes.map((index) => ({
        ...publicPhoto,
        id: `photo-${index}`,
        filename: `photo-${index}.jpg`,
        sortKey: String(index).padStart(8, '0'),
        sources: [
          { contentType: 'image/jpeg', height: 360, url: `/e2e/progressive/photo-${index}-small.svg`, width: 480 },
          { contentType: 'image/jpeg', height: 1200, url: `/e2e/progressive/photo-${index}-large.svg`, width: 1600 },
        ],
      })),
    }), contentType: 'application/json' });
  });
  await page.route('**/e2e/progressive/*.svg', async (route) => {
    photoRequests.push(route.request().url());
    await route.fulfill({ body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#8b5e45"/></svg>', contentType: 'image/svg+xml' });
  });

  await page.goto('/e/mariage-lumiere');
  await expect(page.locator('.gallery-heading__hero img')).toHaveCount(0);
  await expect(page.locator('.photo-tile-shell')).toHaveCount(40);
  await expect(page.locator('.progressive-photo__preview').first()).toHaveJSProperty('complete', true);
  await expect(page.locator('.progressive-photo__optimized').first()).toHaveAttribute('srcset', /480w.*1600w/u);
  await expect(page.locator('.progressive-photo').first()).toHaveClass(/progressive-photo--ready/u);
  expect(photoRequests.some((url) => url.includes('photo-1-small.svg'))).toBe(true);
  expect(photoRequests.some((url) => url.includes('photo-40-large.svg'))).toBe(false);
  expect(pageRequests).toBe(1);

  await page.locator('.gallery-load-sentinel').scrollIntoViewIfNeeded();
  await expect(page.locator('.photo-tile-shell')).toHaveCount(41);
  expect(pageRequests).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.photo-grid__column')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('la visionneuse montre la petite photo puis charge directement la taille adaptee', async ({ page }) => {
  await mockGallery(page);
  const photoRequests: string[] = [];
  let releaseFull: () => void = () => {};
  const fullGate = new Promise<void>((resolve) => { releaseFull = resolve; });
  await page.route('**/api/v1/galleries/mariage-lumiere/photos*', async (route) => {
    await route.fulfill({ body: JSON.stringify({
      eventRevision: publicEvent.revision,
      nextCursor: null,
      photos: Array.from({ length: 40 }, (_, position) => {
        const number = position + 1;
        return {
          ...publicPhoto,
          id: `photo-${number}`,
          filename: `photo-${number}.jpg`,
          sortKey: String(number).padStart(8, '0'),
          sources: [480, 960, 1600].map((width) => ({
            contentType: 'image/jpeg',
            height: width * 3 / 4,
            url: `/e2e/viewer/photo-${number}-${width}.svg`,
            width,
          })),
        };
      }),
    }), contentType: 'application/json' });
  });
  await page.route('**/e2e/viewer/*.svg', async (route) => {
    const url = route.request().url();
    photoRequests.push(url);
    if (url.includes('photo-40-1600.svg')) await fullGate;
    await route.fulfill({ body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#8b5e45"/></svg>', contentType: 'image/svg+xml' });
  });

  await page.goto('/e/mariage-lumiere/photo/photo-40', { waitUntil: 'domcontentloaded' });
  const selected = page.locator('.photo-viewer__slide[aria-hidden="false"]');
  await expect(selected.locator('.progressive-photo__preview')).toHaveJSProperty('naturalWidth', 1600);
  await expect(selected.locator('.progressive-photo__preview')).toHaveCSS('filter', /blur/u);
  await expect(selected.locator('.photo-viewer__ambient')).toHaveAttribute('src', '/e2e/viewer/photo-40-480.svg');
  await expect.poll(() => photoRequests.some((url) => url.includes('photo-40-1600.svg'))).toBe(true);
  expect(photoRequests.some((url) => url.includes('photo-40-960.svg'))).toBe(false);
  await expect(selected.locator('.progressive-photo__optimized')).toHaveCSS('opacity', '0');
  releaseFull();
  await expect(selected.locator('.progressive-photo')).toHaveClass(/progressive-photo--ready/u);
  expect(photoRequests.some((url) => url.includes('photo-38-1600.svg'))).toBe(false);
  expect(photoRequests.filter((url) => url.includes('-480.svg')).length).toBeLessThan(25);
  await page.locator('.photo-viewer__rail button').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.photo-viewer__rail button').last().locator('.progressive-photo__preview')).toHaveJSProperty('naturalWidth', 1600);
});

test('ouvre une galerie publique et sa visionneuse', async ({ page }, testInfo) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  await expect(page.getByRole('heading', { level: 1, name: 'Mariage Lumiere' })).toBeVisible();
  const landscapeTile = await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).boundingBox();
  const portraitTile = await page.getByRole('link', { name: 'portrait-au-jardin.jpg' }).boundingBox();
  expect((portraitTile?.height ?? 0) / (portraitTile?.width ?? 1)).toBeGreaterThan((landscapeTile?.height ?? 0) / (landscapeTile?.width ?? 1));
  await page.screenshot({ path: testInfo.outputPath('gallery-mixed-aspects.png') });
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page).toHaveURL(/\/e\/mariage-lumiere\/photo\/photo-1$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.photo-grid .progressive-photo img')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: /télécharger|download/i })).toHaveAttribute('href', '/media/event-1/photo-1/2/download');
  await dialog.evaluate(async (element) => Promise.all(element.getAnimations().map(async (animation) => animation.finished)));
  const desktopDialogBox = await dialog.boundingBox();
  expect(desktopDialogBox?.x).toBeGreaterThan(16);
  expect(desktopDialogBox?.y).toBeGreaterThan(16);
  expect(desktopDialogBox?.width).toBeLessThan(1_440);
  expect(desktopDialogBox?.height).toBeLessThan(900);
  await expect(dialog).not.toHaveCSS('border-radius', '0px');
  await expect(page.locator('.modal-backdrop--photo-viewer')).not.toHaveCSS('backdrop-filter', 'none');
  await expect(dialog.locator('.photo-viewer__slide--fills-desktop').first().locator('.photo-viewer__image')).toHaveCSS('object-fit', 'cover');
  await page.screenshot({ path: testInfo.outputPath('viewer-landscape.png') });
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
  await nextButton.click();
  await expect(page).toHaveURL(/\/photo\/photo-2$/);
  const portrait = dialog.locator('.photo-viewer__slide').filter({ has: page.locator('img[alt="portrait-au-jardin.jpg"]') });
  await expect(portrait.locator('.photo-viewer__image')).toHaveCSS('object-fit', 'contain');
  await expect(portrait.locator('.photo-viewer__ambient')).toHaveCSS('filter', /blur/);
  await page.screenshot({ path: testInfo.outputPath('viewer-portrait.png') });
  await page.getByRole('button', { name: /photo précédente|previous photo/i }).click();
  await expect(page).toHaveURL(/\/photo\/photo-1$/);
  await page.getByRole('button', { name: /afficher les informations|show photo information/i }).click();
  await expect(page.getByText('danse-au-coucher-du-soleil.jpg')).toBeVisible();
  const capturedAt = dialog.locator('dt', { hasText: /prise de vue|captured/i }).locator('..').locator('dd');
  await expect(capturedAt).toContainText(/20.*2026.*12:00:00.*(?:UTC.?4|EDT)/i);
  await expect(page.getByText('1800 × 1200 px')).toBeVisible();
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(dialog.locator('.photo-viewer__slide--fills-desktop').first().locator('.photo-viewer__image')).toHaveCSS('object-fit', 'contain');
  const mobileDialogBox = await dialog.boundingBox();
  expect(mobileDialogBox).toEqual({ height: 844, width: 390, x: 0, y: 0 });
  await expect(dialog).toHaveCSS('border-radius', '0px');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/e\/mariage-lumiere$/);
  await expect(page.locator('.photo-grid .progressive-photo__preview').first()).toBeVisible();
});

test('selectionne des photos et cree le ZIP de secours avec un bouton retour entier', async ({ page }, testInfo) => {
  await mockGallery(page);
  await page.goto('/e/mariage-lumiere');

  const galleryActions = page.locator('.gallery-heading__actions');
  const findAction = galleryActions.getByRole('link', { name: /retrouver mes photos|find photos of me/i });
  const downloadAction = galleryActions.getByRole('button', { name: /sélectionner des photos|select photos to download/i });
  const findBox = await findAction.boundingBox();
  const downloadBox = await downloadAction.boundingBox();
  expect(findBox).not.toBeNull();
  expect(downloadBox).not.toBeNull();
  expect((downloadBox?.x ?? 0) - ((findBox?.x ?? 0) + (findBox?.width ?? 0))).toBeGreaterThanOrEqual(10);

  const backHome = page.locator('.gallery-heading .back-link');
  await expect(backHome).toBeVisible();
  await expect(backHome).toHaveAccessibleName(/retour aux galeries|back to galleries/i);
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

test('partage le même retour visuel entre la galerie, la recherche et le contact', async ({ page }, testInfo) => {
  await mockGallery(page);
  const appearance = async () => page.locator('.back-link').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderBottomColor: style.borderBottomColor,
      borderBottomWidth: style.borderBottomWidth,
      color: style.color,
      fontWeight: style.fontWeight,
      height: style.height,
    };
  });

  await page.goto('/e/mariage-lumiere');
  const galleryAppearance = await appearance();
  expect(galleryAppearance.borderBottomWidth).toBe('1px');

  await page.goto('/e/mariage-lumiere/find');
  await expect(page.locator('.back-link')).toContainText(/retour à la galerie|back to gallery/i);
  await expect(page.locator('.back-link span')).toHaveText('←');
  expect(await appearance()).toEqual(galleryAppearance);
  await page.screenshot({ path: testInfo.outputPath('find-back-link.png') });

  await page.goto('/contact');
  expect(await appearance()).toEqual(galleryAppearance);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e/mariage-lumiere/find');
  await expect(page.locator('.back-link')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('find-back-link-mobile.png') });
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
  await expect(page.getByRole('alert')).toContainText(/n’a pas pu enregistrer les photos|could not save to that folder/i);
  await page.screenshot({ path: testInfo.outputPath('folder-rejected.png') });
  await page.getByRole('button', { name: /créer un ZIP|create a ZIP/i }).click();
  await expect(page.getByRole('link', { name: /enregistrer le ZIP|save ZIP/i })).toBeVisible();
});

test('enregistre deux fichiers séparés directement dans le dossier choisi', async ({ page }) => {
  await mockGallery(page);
  await page.addInitScript(() => {
    const testWindow = window as Window & { __cadroraWritten?: string[] };
    testWindow.__cadroraWritten = [];
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({
        getDirectoryHandle: () => { throw new Error('No child directory should be created'); },
        getFileHandle: (filename: string, options: { create: boolean }) => options.create ? Promise.resolve({
            createWritable: () => Promise.resolve(new WritableStream<Uint8Array>({
              write: (chunk) => { testWindow.__cadroraWritten?.push(`${filename}:${chunk.byteLength}`); },
            })),
          }) : Promise.reject(new DOMException('Not found', 'NotFoundError')),
        removeEntry: () => Promise.resolve(),
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
  await expect(page.getByRole('region', { name: /sélection des photos|photo download selection/i }))
    .not.toContainText(/pour des fichiers séparés|for separate files|Maj\+clic|Shift-click/i);
  const unavailable = page.getByRole('button', { name: /portrait-au-jardin.jpg n’est pas disponible|portrait-au-jardin.jpg is not available/i });
  await unavailable.click();
  await expect(page.getByText(/télécharger 2 des 3 photos|download 2 of the 3 photos/i)).toBeVisible();
  const help = page.getByRole('button', { name: /pourquoi certaines photos|why are some photos/i });
  await help.click();
  await expect(page.getByText(/télécharger 2 des 3 photos|download 2 of the 3 photos/i)).toBeHidden();
  await help.click();
  await expect(page.getByText(/télécharger 2 des 3 photos|download 2 of the 3 photos/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('selection-help.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(help).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('selection-help-mobile.png') });
  await help.click();
  await expect(page.getByText(/télécharger 2 des 3 photos|download 2 of the 3 photos/i)).toBeHidden();

  await page.getByRole('button', { name: /sélectionner danse-au-coucher-du-soleil|select danse-au-coucher-du-soleil/i }).click();
  await page.getByRole('button', { name: /sélectionner portrait-a-la-fete|select portrait-a-la-fete/i }).click({ modifiers: ['Shift'] });
  await expect(page.getByText(/2 photos sélectionnées|2 photos selected/i)).toBeVisible();
  await expect(unavailable).toBeEnabled();
  await page.getByRole('button', { name: /effacer la sélection|clear selection/i }).click();
  await expect(page.getByText(/0 photo sélectionnée|0 photos selected/i)).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 2, name: /photos où vous apparaissez peut-être|photos you may be in/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /photos prises autour du même moment|photos taken around the same time/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 2, name: /photos où vous apparaissez peut-être|photos you may be in/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /photos prises autour du même moment|photos taken around the same time/i })).toBeVisible();
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

test('partage un coeur entre la mosaïque et la visionneuse privée, puis le retrouve après rechargement', async ({ page }, testInfo) => {
  await mockGallery(page, { protected: true });
  await page.goto('/e/soiree-privee');
  await page.getByLabel(/mot de passe de la galerie|gallery password/i).fill('mot-de-passe');
  await page.getByRole('button', { name: /ouvrir la galerie|open gallery/i }).click();

  const tile = page.locator('.photo-tile-shell').first();
  const like = tile.getByRole('button', { name: /aimer danse|like danse/i });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(tile.getByRole('button', { name: /ne plus aimer danse|unlike danse/i })).toHaveAttribute('aria-pressed', 'true');
  const tileBoxes = await page.locator('.photo-tile-shell').evaluateAll((tiles) => tiles.map((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, width: box.width };
  }));
  expect(tileBoxes[0]?.x).not.toBe(tileBoxes[1]?.x);
  expect(tileBoxes[0]?.width).toBeGreaterThan(300);
  await page.getByRole('button', { name: /nécessaire seulement|essential only/i }).click();
  await page.screenshot({ path: testInfo.outputPath('private-mosaic-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('private-mosaic-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1_440, height: 900 });

  await tile.getByRole('link').click();
  const viewerUnlike = page.getByRole('dialog').getByRole('button', { name: /ne plus aimer danse|unlike danse/i });
  await expect(viewerUnlike).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('button', { name: /ne plus aimer danse|unlike danse/i })).toHaveAttribute('aria-pressed', 'true');
  await viewerUnlike.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /aimer danse|like danse/i })).toHaveAttribute('aria-pressed', 'false');
});

test('garde les coeurs publics dans le navigateur sans ecriture serveur', async ({ page }) => {
  await mockGallery(page);
  let favoriteWrites = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/favorite')) favoriteWrites += 1;
  });
  await page.goto('/e/mariage-lumiere');
  const tile = page.locator('.photo-tile-shell').first();
  await tile.getByRole('button', { name: /aimer danse|like danse/i }).click();
  await expect(tile.locator('.favorite-button')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('cadrora:public-favorites:event-1'))).toContain('photo-1');
  await page.reload();
  await expect(page.locator('.photo-tile-shell').first().locator('.favorite-button')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page.getByRole('dialog').locator('.favorite-button')).toHaveAttribute('aria-pressed', 'true');
  expect(favoriteWrites).toBe(0);
});

test('garde la sélection retouche distincte du coeur sur téléphone', async ({ page }, testInfo) => {
  await mockGallery(page, { protected: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e/soiree-privee');
  await page.getByRole('textbox', { name: /mot de passe|password/i }).fill('mot-de-passe');
  await page.getByRole('button', { name: /ouvrir la galerie|unlock gallery/i }).click();
  const tile = page.locator('.photo-tile-shell').first();
  const retouch = tile.getByRole('button', { name: /sélectionner .*retouche|select .*retouch/i });
  await retouch.click();
  await expect(tile.getByRole('button', { name: /retirer .*retouche|remove .*retouch/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(tile.locator('.favorite-button')).toHaveAttribute('aria-pressed', 'false');
  await tile.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page.getByRole('dialog').locator('.retouch-button')).toHaveAttribute('aria-pressed', 'true');
  const viewer = await page.getByRole('dialog').boundingBox();
  expect(viewer).toEqual({ height: 844, width: 390, x: 0, y: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('retouch-viewer-mobile.png') });
});

test('masque la sélection retouche fermée et garde les coeurs privés', async ({ page }) => {
  await mockGallery(page, { protected: true, retouchEnabled: false });
  await page.goto('/e/soiree-privee');
  await page.getByRole('textbox', { name: /mot de passe|password/i }).fill('mot-de-passe');
  await page.getByRole('button', { name: /ouvrir la galerie|unlock gallery/i }).click();
  await expect(page.locator('.retouch-button')).toHaveCount(0);
  await expect(page.locator('.favorite-button')).toHaveCount(2);
  await page.getByRole('link', { name: 'danse-au-coucher-du-soleil.jpg' }).click();
  await expect(page.getByRole('dialog').locator('.retouch-button')).toHaveCount(0);
  await expect(page.getByRole('dialog').locator('.favorite-button')).toHaveCount(1);
});
