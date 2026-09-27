// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AdminSiteSettingsPage } from '../../../src/app/admin/AdminSiteSettingsPage';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';

const settings = {
  analyticsMeasurementId: null, contactAddress: null, contactEmail: null, contactPhone: null,
  defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'], enabledServices: ['wedding'],
  homeGalleries: { enabled: true, limit: 6 },
  homeServicesLimit: 3,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
  quotas: { faceLimit: 39000, storageLimitBytes: 9900000000 },
  usage: { faces: 0, storageBytes: 0 },
  serviceArea: null, siteName: 'Atelier Giulia',
  siteCopy: {
    fr: { description: 'Portraits et célébrations.', footerTagline: 'Des images pleines de vie.' },
    en: { description: 'Portraits and celebrations.', footerTagline: 'Photography with feeling.' },
  },
  themeMode: 'both', updatedAt: '2026-09-26T00:00:00.000Z',
};

beforeAll(() => {
  installPublicResources(i18n);
  for (const language of ['fr', 'en'] as const) {
    i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
  }
});

afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await i18n.changeLanguage('fr'); });

describe('admin site copy', () => {
  it('edits both fields through one primary input and saves their translations in one PATCH', async () => {
    let saved: Record<string, unknown> | null = null;
    let patchCount = 0;
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH' && typeof options.body === 'string') {
        patchCount += 1;
        saved = JSON.parse(options.body) as Record<string, unknown>;
      }
      return Promise.resolve(new Response(JSON.stringify(settings), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdminSiteSettingsPage /></QueryClientProvider>);

    const name = await screen.findByRole('textbox', { name: 'Nom du studio ou du site' });
    const requestsBeforeEditing = fetchMock.mock.calls.length;
    expect(screen.getByRole('textbox', { name: 'Description du site · Français' })).toHaveProperty('value', 'Portraits et célébrations.');
    expect(screen.getByRole('textbox', { name: 'Texte après le nom du site · Français' })).toHaveProperty('value', 'Des images pleines de vie.');
    expect(screen.queryByRole('textbox', { name: 'Description du site · Anglais' })).toBeNull();
    expect(document.querySelector('fieldset:last-of-type')?.id).toBe('admin-settings-footer');
    expect(screen.queryByRole('textbox', { name: 'Titre principal · Français' })).toBeNull();

    fireEvent.change(name, { target: { value: 'Studio Boréal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Traductions : Description du site' }));
    let dialog = screen.getByRole('dialog', { name: 'Traductions : Description du site' });
    expect(within(dialog).getByRole('textbox', { name: 'Français' })).toHaveProperty('value', 'Portraits et célébrations.');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Anglais' }), { target: { value: 'Portraits and memories.' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fermer les traductions' }).at(-1)!);

    fireEvent.change(screen.getByRole('textbox', { name: 'Texte après le nom du site · Français' }), { target: { value: 'Nos souvenirs.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Traductions : Texte après le nom du site' }));
    dialog = screen.getByRole('dialog', { name: 'Traductions : Texte après le nom du site' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Anglais' }), { target: { value: 'Stories to remember.' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fermer les traductions' }).at(-1)!);

    expect(patchCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(requestsBeforeEditing);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages publics' }));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(patchCount).toBe(1);
    expect(saved).toMatchObject({
      siteName: 'Studio Boréal',
      siteCopy: { fr: { description: 'Portraits et célébrations.', footerTagline: 'Nos souvenirs.' }, en: { description: 'Portraits and memories.', footerTagline: 'Stories to remember.' } },
    });
  });

  it('flags missing enabled translations and clears the warning as soon as they are filled', async () => {
    let saved: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH' && typeof options.body === 'string') saved = JSON.parse(options.body) as Record<string, unknown>;
      return Promise.resolve(new Response(JSON.stringify({
        ...settings,
        siteCopy: { fr: settings.siteCopy.fr, en: { footerTagline: '' } },
      }), { status: 200 }));
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdminSiteSettingsPage /></QueryClientProvider>);

    await screen.findByRole('textbox', { name: 'Description du site · Français' });
    const trigger = screen.getByRole('button', { name: 'Traductions : Description du site · 1 traduction manquante' });
    expect(within(trigger).getByText('1')).not.toBeNull();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Traductions : Description du site' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Anglais' }), { target: { value: 'New English description.' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fermer les traductions' }).at(-1)!);
    expect(screen.getByRole('button', { name: 'Traductions : Description du site' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages publics' }));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ siteCopy: { en: { description: 'New English description.' } } });
  });

  it('shows the admin language as the primary field without duplicating both languages on the page', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(settings), { status: 200 }))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdminSiteSettingsPage /></QueryClientProvider>);

    expect(await screen.findByRole('textbox', { name: 'Website description · English' })).toHaveProperty('value', 'Portraits and celebrations.');
    expect(screen.queryByRole('textbox', { name: 'Website description · French' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Translations: Website description' }));
    const dialog = screen.getByRole('dialog', { name: 'Translations: Website description' });
    expect(within(dialog).getByRole('textbox', { name: 'French' })).toHaveProperty('value', 'Portraits et célébrations.');
  });
});
