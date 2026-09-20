// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { ContactPage } from '../../../src/app/public/InfoPage';
import { HomePage } from '../../../src/app/public/HomePage';
import { installPublicResources } from '../../../src/app/public/i18n';

beforeAll(() => {
  installPublicResources(i18n);
});

beforeEach(async () => {
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

    expect(screen.getByRole('heading', { level: 1, name: 'Des instants vrais, magnifiquement cadrés.' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Une photographie profondément personnelle.' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/galeries publiques sont temporairement indisponibles/i)).toBeTruthy());
  });

  it('never invents contact coordinates when the public profile is empty', () => {
    renderPage(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Créons quelque chose de mémorable.' })).toBeTruthy();
    expect(screen.getByText(/coordonnées seront publiées ici/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });
});
