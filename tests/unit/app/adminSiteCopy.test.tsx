// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AdminSiteSettingsPage } from '../../../src/app/admin/AdminSiteSettingsPage';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';

const settings = {
  analyticsMeasurementId: null, contactAddress: null, contactEmail: null, contactPhone: null,
  defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'], enabledServices: ['wedding'],
  homeGalleries: { enabled: true, limit: 6 },
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('admin site copy', () => {
  it('keeps Home code-owned and sends the bilingual description and footer with the site name', async () => {
    let saved: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH' && typeof options.body === 'string') saved = JSON.parse(options.body) as Record<string, unknown>;
      return Promise.resolve(new Response(JSON.stringify(settings), { status: 200 }));
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdminSiteSettingsPage /></QueryClientProvider>);

    const name = await screen.findByRole('textbox', { name: 'Nom du studio ou du site' });
    expect(screen.getByRole('textbox', { name: 'Description du site · Français' })).toHaveProperty('value', 'Portraits et célébrations.');
    expect(screen.getByRole('textbox', { name: 'Texte après le nom du site · Français' })).toHaveProperty('value', 'Des images pleines de vie.');
    expect(document.querySelector('fieldset:last-of-type')?.id).toBe('admin-settings-footer');
    expect(screen.queryByRole('textbox', { name: 'Titre principal · Français' })).toBeNull();

    fireEvent.change(name, { target: { value: 'Studio Boréal' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Texte après le nom du site · Français' }), { target: { value: 'Nos souvenirs.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages publics' }));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      siteName: 'Studio Boréal',
      siteCopy: { fr: { description: 'Portraits et célébrations.', footerTagline: 'Nos souvenirs.' }, en: { description: 'Portraits and celebrations.', footerTagline: 'Photography with feeling.' } },
    });
  });
});
