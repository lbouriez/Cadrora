// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { ContactPage } from '../../../src/app/public/InfoPage';
import { PrivacyPage } from '../../../src/app/public/InfoPage';
import { HomePage } from '../../../src/app/public/HomePage';
import { installPublicResources } from '../../../src/app/public/i18n';

beforeAll(() => {
  installPublicResources(i18n);
});

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fr');
});

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('public photographer website', () => {
  it('keeps the showcase content useful when the gallery API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderPage(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Chaque photo. Plus facile à retrouver.' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Une photographie profondément personnelle.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Essayer le chercheur IA' }).getAttribute('href')).toBe('/e/find-your-photos/find');
    await waitFor(() => expect(screen.getByText(/galeries publiques sont temporairement indisponibles/i)).toBeTruthy());
  });

  it('ships clearly-labelled template contact details for the demonstration', () => {
    renderPage(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Créons quelque chose de mémorable.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'bonjour@cadrora.com' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '+1 514 555-0142' })).toBeTruthy();
    expect(screen.getByText(/coordonnées sont fictives/i)).toBeTruthy();
  });

  it('explains AI, retention, analytics, and operator responsibility in the privacy notice', () => {
    renderPage(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: 'IA facultative et recherche faciale' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conservation et suppression' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Témoins et mesure d'audience" })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Responsabilités de l'exploitant" })).toBeTruthy();
  });
});
