// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { ContactPage } from '../../../src/app/public/InfoPage';
import { PrivacyPage } from '../../../src/app/public/InfoPage';
import { HomePage } from '../../../src/app/public/HomePage';
import { installFindResources } from '../../../src/app/public/FindI18n';
import { installPublicResources } from '../../../src/app/public/i18n';

beforeAll(() => {
  installPublicResources(i18n);
  installFindResources(i18n);
});

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fr');
});

afterEach(() => vi.unstubAllGlobals());

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

    expect(screen.getByRole('heading', { level: 1, name: 'Vos moments préférés. Plus faciles à retrouver.' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Des photos qui vous ressemblent.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retrouver des photos avec l’IA' }).getAttribute('href')).toBe('/e/find-your-photos/find');
    await waitFor(() => expect(screen.getByText(/galeries ne sont pas disponibles pour le moment/i)).toBeTruthy());
  });

  it('renders contact details supplied by D1 without a demo disclaimer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteName: 'Atelier Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: 'studio@runtime.example', contactPhone: '+1 438 555-0199',
      contactAddress: '456 rue du Studio, Québec', serviceArea: 'Québec et Charlevoix',
      enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'both',
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      updatedAt: '2026-09-23T00:00:00.000Z',
    }), { headers: { 'content-type': 'application/json' }, status: 200 })));
    renderPage(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Créons quelque chose de mémorable.' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('link', { name: 'studio@runtime.example' })).toBeTruthy());
    expect(screen.getByRole('link', { name: '+1 438 555-0199' })).toBeTruthy();
    expect(screen.getByText('456 rue du Studio, Québec')).toBeTruthy();
    expect(screen.queryByText(/coordonnées sont fictives/i)).toBeNull();
  });

  it('explains AI, retention, analytics, and operator responsibility in the privacy notice', () => {
    renderPage(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: 'IA facultative et recherche faciale' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conservation et suppression' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Comment nous comptons les visites' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Qui est responsable de ce site?' })).toBeTruthy();
  });

  it('uses natural singular and plural labels for photo results in both languages', async () => {
    expect(i18n.t('faceFind.resultCount', { count: 1 })).toBe('1 photo possible trouvée dans cette galerie.');
    expect(i18n.t('faceFind.nearbyFound', { count: 2 })).toContain('2 autres photos');
    expect(i18n.t('gallery.downloadSelection.count', { count: 1 })).toBe('1 photo sélectionnée');
    expect(i18n.t('gallery.downloadSelection.count', { count: 0 })).toBe('0 photo sélectionnée');

    await i18n.changeLanguage('en');
    expect(i18n.t('faceFind.resultCount', { count: 1 })).toBe('1 possible photo found in this gallery.');
    expect(i18n.t('faceFind.nearbyFound', { count: 2 })).toContain('2 more photos');
    expect(i18n.t('gallery.downloadSelection.count', { count: 1 })).toBe('1 photo selected');
  });
});
