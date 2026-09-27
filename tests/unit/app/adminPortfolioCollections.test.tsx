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

  it('selects a published photo as the collection card cover', async () => {
    const service = { id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: null, imageRevision: null, imageSources: [] };
    const source = (id: string) => ({ url: `/portfolio-media/${id}/small`, width: 640, height: 426 });
    const collection = { id: 'collection-1', slug: 'familles', serviceId: 'family', sortOrder: 0,
      copy: { fr: { title: 'Familles', description: '' }, en: { title: 'Families', description: '' } },
      published: true, coverPhotoId: 'photo-1', coverSources: [source('photo-1')], photoCount: 2,
      photos: ['photo-1', 'photo-2'].map((id) => ({ id, collectionId: 'collection-1', serviceId: 'family',
        alt: { fr: id, en: id }, sortOrder: id === 'photo-1' ? 0 : 1, state: 'published', imageSources: [source(id)] })) };
    let requestBody: unknown;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/admin/services') return Promise.resolve(new Response(JSON.stringify([service])));
      if (url === '/api/v1/admin/portfolio/collections/collection-1' && init?.method === 'PATCH') {
        requestBody = JSON.parse(typeof init.body === 'string' ? init.body : '') as unknown;
        return Promise.resolve(new Response(JSON.stringify({ ...collection, coverPhotoId: 'photo-2' })));
      }
      if (url === '/api/v1/admin/portfolio/collections/collection-1') {
        return Promise.resolve(new Response(JSON.stringify(collection)));
      }
      if (url === '/api/v1/admin/portfolio/collections') return Promise.resolve(new Response('[]'));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    const view = render(<QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/portfolio/collection-1']}>
        <Routes><Route element={<AdminPortfolioPage />} path="/admin/portfolio/:id" /></Routes>
      </MemoryRouter>
    </QueryClientProvider>);
    const choice = await screen.findByRole('button', { name: 'Utiliser photo-2 comme couverture' });
    fireEvent.click(choice);
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    const submit = view.container.querySelector<HTMLButtonElement>('.admin-card form button[type="submit"]');
    expect(submit).not.toBeNull();
    if (!submit) throw new Error('Missing collection form submit button');
    fireEvent.click(submit);
    await waitFor(() => expect(requestBody).toMatchObject({ coverPhotoId: 'photo-2' }));
  });
});
