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
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await i18n.changeLanguage('fr'); });

describe('service catalog editor', () => {
  it.each(['fr', 'en'] as const)('previews, saves, and reloads the phone override in %s without uploading again', async (language) => {
    await i18n.changeLanguage(language);
    let card = ServiceCardSchema.parse({ id: 'maternity', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: { fr: { title: 'Maternité', shortDescription: 'Court', description: 'Long', points: [] },
        en: { title: 'Maternity', shortDescription: 'Short', description: 'Long', points: [] } },
      imageRevision: null, imageSources: [],
    });
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(typeof init.body === 'string' ? init.body : '') as Record<string, unknown>;
        writes.push(body);
        card = ServiceCardSchema.parse({ ...card, ...body });
        return Promise.resolve(new Response(JSON.stringify(card)));
      }
      if (url === '/api/v1/admin/services') return Promise.resolve(new Response(JSON.stringify([card])));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    const mount = () => render(<QueryClientProvider client={new QueryClient()}><ServiceCatalogEditor
      enabledLanguages={['fr', 'en']} primaryLanguage={language} readOnly={false} /></QueryClientProvider>);
    const view = mount();
    fireEvent.click(await screen.findByText(language === 'fr' ? 'Maternité' : 'Maternity', { selector: 'summary' }));
    const label = (key: string) => i18n.t(`admin.serviceEditor.${key}`);
    const desktop = screen.getByLabelText(label('desktopAlignment'));
    const mobile = screen.getByLabelText(label('mobileAlignment'));
    expect((desktop as HTMLSelectElement).value).toBe('center');
    expect((mobile as HTMLSelectElement).value).toBe('');
    fireEvent.change(desktop, { target: { value: 'left' } });
    fireEvent.change(mobile, { target: { value: 'right' } });
    expect(document.querySelector('.admin-service-editor__preview')?.classList.contains('service-photo--left')).toBe(true);
    expect(document.querySelector('.session-story--preview .service-photo')?.classList.contains('service-photo--right')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ photoAlignment: 'left', mobilePhotoAlignment: 'right' });
    view.unmount(); mount();
    fireEvent.click(await screen.findByText(language === 'fr' ? 'Maternité' : 'Maternity', { selector: 'summary' }));
    expect(screen.getByLabelText<HTMLSelectElement>(label('desktopAlignment')).value).toBe('left');
    expect(screen.getByLabelText<HTMLSelectElement>(label('mobileAlignment')).value).toBe('right');
    fireEvent.change(screen.getByLabelText(label('mobileAlignment')), { target: { value: '' } });
    expect(document.querySelector('.session-story--preview .service-photo')?.classList.contains('service-photo--left')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({ photoAlignment: 'left', mobilePhotoAlignment: null });
  });

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
      primaryLanguage="fr" readOnly={false} /></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Mariages personnalisés', { selector: 'summary' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Durée de la séance (facultatif) · Français' }),
      { target: { value: '8 heures' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));
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
      primaryLanguage="fr" readOnly={false} /></QueryClientProvider>);

    const summary = await screen.findByText('Mariages personnalisés', { selector: 'summary' });
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
