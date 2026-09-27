// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ServiceCatalogEditor } from '../../../src/app/admin/ServiceCatalogEditor';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { serviceEditorResources } from '../../../src/app/admin/serviceEditorResources';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { ServiceCardSchema } from '../../../src/shared/schemas';

beforeAll(() => {
  installPublicResources(i18n);
  for (const language of ['fr', 'en'] as const) {
    i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
    i18n.addResourceBundle(language, 'translation', serviceEditorResources[language], true, true);
  }
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('service catalog editor', () => {
  it('saves the new bilingual duration, pricing, and detail fields with an existing service', async () => {
    const card = ServiceCardSchema.parse({
      id: 'wedding', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: {
        fr: { title: 'Mariages personnalisés', shortDescription: 'Court', description: 'Long', points: [],
          duration: '6 heures', priceRange: '2 000 $ à 3 000 $', details: 'Rencontre incluse.' },
        en: { title: 'Custom weddings', shortDescription: 'Short', description: 'Long', points: [],
          duration: '6 hours', priceRange: '$2,000 to $3,000', details: 'Consultation included.' },
      }, imageRevision: null, imageSources: [],
    });
    let savedBody: unknown;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/admin/services/wedding' && init?.method === 'PATCH') {
        savedBody = JSON.parse(typeof init.body === 'string' ? init.body : '') as unknown;
        return Promise.resolve(new Response(JSON.stringify(card)));
      }
      if (url === '/api/v1/admin/services') return Promise.resolve(new Response(JSON.stringify([card])));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ServiceCatalogEditor enabledLanguages={['fr', 'en']}
      homeLimit={3} primaryLanguage="fr" readOnly={false} /></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Mariages personnalisés'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Durée de la séance (facultatif) · Français' }),
      { target: { value: '8 heures' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le service' }));
    await waitFor(() => expect(savedBody).toBeDefined());
    expect(savedBody).toMatchObject({ copy: {
      fr: { duration: '8 heures', priceRange: '2 000 $ à 3 000 $', details: 'Rencontre incluse.' },
      en: { duration: '6 hours', priceRange: '$2,000 to $3,000', details: 'Consultation included.' },
    } });
  });

  it('restores a built-in service’s example text and photo together', async () => {
    let card = ServiceCardSchema.parse({
      id: 'wedding', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: { fr: { title: 'Mariages personnalisés', shortDescription: 'Court', description: 'Long', points: [] },
        en: { title: 'Custom weddings', shortDescription: 'Short', description: 'Long', points: [] } },
      imageRevision: 3,
      imageSources: [{ url: '/service-media/wedding/3/preview', width: 320, height: 213 }],
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/admin/services/wedding/reset' && init?.method === 'POST') {
        card = ServiceCardSchema.parse({ ...card, copy: null, imageRevision: null, imageSources: [] });
        return Promise.resolve(new Response(JSON.stringify(card)));
      }
      if (url === '/api/v1/admin/services') return Promise.resolve(new Response(JSON.stringify([card])));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ServiceCatalogEditor enabledLanguages={['fr', 'en']}
      homeLimit={3} primaryLanguage="fr" readOnly={false} /></QueryClientProvider>);

    const summary = await screen.findByText('Mariages personnalisés');
    fireEvent.click(summary);
    expect(document.querySelector('.admin-service-editor__preview img')?.getAttribute('src'))
      .toBe('/service-media/wedding/3/preview');
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir l’exemple' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/services/wedding/reset',
      expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(document.querySelector('.admin-service-editor__preview img')?.getAttribute('src'))
      .toMatch(/^\/brand\//u));
    expect(screen.getByRole('textbox', { name: 'Titre · Français' }).getAttribute('value')).not.toBe('Mariages personnalisés');
  });
});
