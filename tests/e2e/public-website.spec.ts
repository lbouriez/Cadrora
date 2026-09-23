import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.describe('site vitrine statique', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/galleries', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ code: 'E2E_GALLERY_OFFLINE', message: 'errors.serviceUnavailable', requestId: 'e2e' }),
        contentType: 'application/json',
        status: 503,
      });
    });
  });

  test('reste utile lorsque les galeries sont indisponibles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/chaque photo|every photo/i);
    await expect(page.getByRole('heading', { name: /photographie profondément personnelle|photography made personal/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/temporairement indisponibles|temporarily unavailable/i);
    await expect(page.getByRole('link', { name: /essayer le chercheur ia|try the ai photo finder|tester l’ia|try ai search/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('publie les coordonnees sans formulaire ni dependance distante', async ({ page }) => {
    const remoteRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4178') remoteRequests.push(request.url());
    });

    await page.goto('/contact');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/créons quelque chose|create something/i);
    await expect(page.getByRole('link', { name: '+1 514 555 0142' })).toHaveAttribute('href', 'tel:+15145550142');
    await expect(page.getByRole('link', { name: 'bonjour@example.test' })).toHaveAttribute('href', 'mailto:bonjour@example.test');
    await expect(page.getByText('123 rue Lumiere, Montreal')).toBeVisible();
    await expect(page.getByText('Montreal et environs')).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    expect(remoteRequests).toEqual([]);
  });

  test('relie les services, les demonstrations et la confidentialite', async ({ page }) => {
    await page.goto('/services');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/images sensibles|photography with feeling/i);
    await expect(page.getByRole('heading', { name: /mariages|weddings/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto('/galleries');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/beauté de la livraison|beautiful delivery/i);
    await expect(page.getByRole('link', { name: /tester le chercheur de photos ia|test the ai photo finder/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /admin en lecture seule|read-only admin/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /IA facultative et recherche faciale|optional AI and face search/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /témoins et mesure d'audience|cookies and analytics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nécessaire seulement|necessary only/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('ne conserve pas de redirection depuis l ancienne route events', async ({ page }) => {
    await page.goto('/events');

    await expect(page).toHaveURL(/\/events$/u);
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText(/beauté de la livraison|beautiful delivery/i);
  });

  test('garde la navigation et les actions principales compactes sur telephone', async ({ page }) => {
    await page.setViewportSize({ width: 330, height: 740 });
    await page.addInitScript(() => localStorage.setItem('cadrora-privacy-consent-v1', 'necessary'));
    await page.goto('/');

    const header = page.locator('.public-header');
    expect((await header.boundingBox())?.height).toBeLessThan(85);
    const actions = await page.locator('.site-actions .button').all();
    expect(actions).toHaveLength(2);
    expect((await actions[0]?.boundingBox())?.y).toBe((await actions[1]?.boundingBox())?.y);
    const portrait = await page.locator('.site-hero__ai-card img').boundingBox();
    expect(portrait?.height).toBeLessThan(80);
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /ouvrir le menu|open menu/i }).click();
    await expect(page.getByRole('navigation', { name: /navigation principale|primary navigation/i })).toBeVisible();
    await page.getByRole('navigation', { name: /navigation principale|primary navigation/i }).getByRole('link', { name: /services/i }).click();
    await expect(page.getByRole('button', { name: /ouvrir le menu|open menu/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('garde la legende photo lisible en theme sombre', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cadrora-theme', 'dark');
      localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
    });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const caption = page.locator('.site-hero__art figcaption');
    await expect(caption).toBeVisible();
    expect(await caption.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
    expect(await caption.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  });
});
