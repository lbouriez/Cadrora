import { assertNoHorizontalOverflow, expect, test } from './fixtures';

test.describe('site vitrine statique', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/events', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ code: 'E2E_GALLERY_OFFLINE', message: 'errors.serviceUnavailable', requestId: 'e2e' }),
        contentType: 'application/json',
        status: 503,
      });
    });
  });

  test('reste utile lorsque les galeries sont indisponibles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/instants vrais|true moments/i);
    await expect(page.getByRole('heading', { name: /photographie profondément personnelle|photography made personal/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/temporairement indisponibles|temporarily unavailable/i);
    await expect(page.getByRole('link', { name: /parler de votre projet|talk about your project/i })).toBeVisible();
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

    await page.goto('/events');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/beauté de la livraison|beautiful delivery/i);
    await expect(page.getByText('cadrora-demo').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /admin en lecture seule|read-only admin/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /IA facultative et recherche faciale|optional AI and face search/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /témoins et mesure d'audience|cookies and analytics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nécessaire seulement|necessary only/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
