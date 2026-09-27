// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { HomeHeroEditor } from '../../../src/app/admin/HomeHeroEditor';
import { homeHeroResources } from '../../../src/app/admin/homeHeroResources';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { AdminSiteSettingsSchema } from '../../../src/shared/schemas';

const settings = AdminSiteSettingsSchema.parse({
  siteName: 'Studio', siteCopy: null, defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['wedding'], homeGalleries: { enabled: true, limit: 6 }, homeServicesLimit: 3,
  homeHeroCopy: null, homeHeroImageRevision: null,
  analyticsMeasurementId: null, themeMode: 'both', updatedAt: '2026-09-27T00:00:00.000Z',
  quotaCeilings: { faceLimit: 39000, storageLimitBytes: 9900000000 },
  quotas: { faceLimit: 39000, storageLimitBytes: 9900000000 }, usage: { faces: 0, storageBytes: 0 },
});

beforeAll(() => {
  installPublicResources(i18n);
  for (const language of ['fr', 'en'] as const) {
    i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
    i18n.addResourceBundle(language, 'translation', homeHeroResources[language], true, true);
  }
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Home introduction editor', () => {
  it('opens on demand, saves both languages, and restores the compiled example', async () => {
    let savedBody: unknown = null;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/reset')) return Promise.resolve(new Response(JSON.stringify(settings)));
      if (init?.method === 'PATCH') {
        savedBody = typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null;
        return Promise.resolve(new Response(JSON.stringify({ ...settings, homeHeroCopy: savedBody })));
      }
      return Promise.reject(new Error('Unexpected request'));
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><HomeHeroEditor enabledLanguages={['fr', 'en']}
      primaryLanguage="fr" readOnly={false} settings={settings} /></QueryClientProvider>);

    const disclosure = screen.getByText('Introduction de l’accueil').closest('details');
    expect(disclosure?.open).toBe(false);
    fireEvent.click(screen.getByText('Introduction de l’accueil'));
    expect(disclosure?.open).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Petit titre · Français' }), { target: { value: 'Histoires choisies' } });
    fireEvent.click(screen.getByRole('button', { name: 'Traductions : Petit titre' }));
    const dialog = screen.getByRole('dialog', { name: 'Traductions : Petit titre' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Anglais' }), { target: { value: 'Chosen stories' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fermer les traductions' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’introduction' }));
    await waitFor(() => expect(savedBody).toMatchObject({ fr: { label: 'Histoires choisies' }, en: { label: 'Chosen stories' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir l’exemple' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/reset'))).toBe(true));
  });
});
