// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AdminPortfolioPage } from '../../../src/app/admin/AdminPortfolioPage';
import { portfolioResources } from '../../../src/app/admin/portfolioResources';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';

beforeAll(() => {
  installPublicResources(i18n);
  for (const language of ['fr', 'en'] as const) {
    i18n.addResourceBundle(language, 'translation', portfolioResources[language], true, true);
  }
  void i18n.changeLanguage('fr');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('admin portfolio collections', () => {
  it('creates a bilingual collection in the selected service before any photo upload', async () => {
    const service = { id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: null, imageRevision: null, imageSources: [] };
    const created = { id: 'collection-1', slug: 'familles', serviceId: 'family', sortOrder: 0,
      copy: { fr: { title: 'Familles', description: 'Des instants partagés.' },
        en: { title: 'Families', description: 'Shared moments.' } },
      published: false, coverPhotoId: null, coverSources: [], photoCount: 0, photos: [] };
    let requestBody: unknown;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/admin/services') return Promise.resolve(new Response(JSON.stringify([service])));
      if (url === '/api/v1/admin/portfolio/collections' && init?.method === 'POST') {
        requestBody = JSON.parse(typeof init.body === 'string' ? init.body : '') as unknown;
        return Promise.resolve(new Response(JSON.stringify(created), { status: 201 }));
      }
      if (url === '/api/v1/admin/portfolio/collections') return Promise.resolve(new Response('[]'));
      if (url === '/api/v1/admin/portfolio/collections/collection-1') return Promise.resolve(new Response(JSON.stringify(created)));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/admin/portfolio']}>
      <Routes><Route element={<AdminPortfolioPage />} path="/admin/portfolio" />
        <Route element={<AdminPortfolioPage />} path="/admin/portfolio/:id" /></Routes>
    </MemoryRouter></QueryClientProvider>);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Titre de la collection en français' }),
      { target: { value: 'Familles' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre de la collection en anglais' }),
      { target: { value: 'Families' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description de la collection en français' }),
      { target: { value: 'Des instants partagés.' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description de la collection en anglais' }),
      { target: { value: 'Shared moments.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la collection' }));
    await waitFor(() => expect(requestBody).toMatchObject({ slug: 'familles', serviceId: 'family', copy: {
      fr: { title: 'Familles', description: 'Des instants partagés.' },
      en: { title: 'Families', description: 'Shared moments.' },
    } }));
    expect(await screen.findByText('Ajoutez une photo avant de publier cette collection.')).toBeTruthy();
    expect(document.querySelector('input[type="file"][multiple]')).not.toBeNull();
  });
});
