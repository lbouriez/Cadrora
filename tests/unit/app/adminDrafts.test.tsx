// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AdminAboutPage } from '../../../src/app/admin/AdminAboutPage';
import { aboutResources } from '../../../src/app/admin/aboutResources';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { serviceEditorResources } from '../../../src/app/admin/serviceEditorResources';
import { ServiceCatalogEditor } from '../../../src/app/admin/ServiceCatalogEditor';
import { clearAdminDrafts } from '../../../src/app/admin/useAdminDraft';
import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { ServiceCardSchema } from '../../../src/shared/schemas';

vi.mock('../../../src/app/admin/uploadMarketingPhoto', () => ({ uploadMarketingPhoto: vi.fn().mockResolvedValue(undefined) }));

beforeAll(() => {
  installPublicResources(i18n);
  for (const language of ['fr', 'en'] as const) {
    for (const resource of [adminResourceFragment, aboutResources, serviceEditorResources]) {
      i18n.addResourceBundle(language, 'translation', resource[language], true, true);
    }
  }
});
afterEach(async () => { cleanup(); clearAdminDrafts(); vi.unstubAllGlobals(); await i18n.changeLanguage('fr'); });

function leavingIsPrevented() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('admin copy drafts and photo success messages', () => {
  it.each(['fr', 'en'] as const)('keeps unsaved About text after a portrait upload and navigation in %s', async (language) => {
    await i18n.changeLanguage(language);
    let settings = {
      analyticsMeasurementId: null, contactAddress: null, contactEmail: null, contactPhone: null,
      defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'], enabledServices: ['family'],
      homeGalleries: { enabled: false, limit: 6 },
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      quotaCeilings: { faceLimit: 1000, storageLimitBytes: 1000000000 },
      quotas: { faceLimit: 1000, storageLimitBytes: 1000000000 }, usage: { faces: 0, storageBytes: 0 },
      serviceArea: null, siteName: 'Studio', siteCopy: null, themeMode: 'both',
      aboutCopy: { fr: { title: 'Giulia', body: 'Présentation', imageAlt: '' }, en: { title: 'Giulia', body: 'Introduction', imageAlt: '' } },
      updatedAt: '2026-10-25T00:00:00.000Z',
    };
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && typeof init.body === 'string') {
        const body = JSON.parse(init.body) as { copy: typeof settings.aboutCopy };
        settings = { ...settings, aboutCopy: body.copy };
      }
      return Promise.resolve(Response.json(settings));
    });
    vi.stubGlobal('fetch', fetchMock);
    const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminAboutPage />
    </QueryClientProvider>);
    const view = mount();
    const label = (key: string) => i18n.t(`admin.about.${key}`);
    const field = await screen.findByRole('textbox', { name: new RegExp(`^${label('body')}`) });
    fireEvent.change(field, { target: { value: 'My unsaved introduction' } });
    fireEvent.change(screen.getByLabelText(label('photo')), { target: { files: [new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(label('photoSaved'));
    expect(screen.queryByText(label('saved'))).toBeNull();
    expect(screen.getByText(label('unsaved'))).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    view.unmount();
    expect(leavingIsPrevented()).toBe(true);
    const restored = mount();
    expect(await screen.findByRole('textbox', { name: new RegExp(`^${label('body')}`) })).toHaveProperty('value', 'My unsaved introduction');
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(leavingIsPrevented()).toBe(false);
    restored.unmount();
    mount();
    expect(await screen.findByRole('textbox', { name: new RegExp(`^${label('body')}`) })).toHaveProperty('value', 'My unsaved introduction');
  });

  it('does not claim a session draft was saved by uploading its photo', async () => {
    await i18n.changeLanguage('en');
    let card = ServiceCardSchema.parse({ id: 'family', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
      copy: { fr: { title: 'Familles', shortDescription: 'Court', description: 'Long', points: [] },
        en: { title: 'Families', shortDescription: 'Short', description: 'Long', points: [] } }, imageRevision: null, imageSources: [] });
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && typeof init.body === 'string') {
        card = ServiceCardSchema.parse({ ...card, ...JSON.parse(init.body) as Record<string, unknown> });
        return Promise.resolve(Response.json(card));
      }
      if (url === '/api/v1/admin/services') return Promise.resolve(Response.json([card]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }));
    const mount = () => render(<QueryClientProvider client={new QueryClient()}>
      <ServiceCatalogEditor enabledLanguages={['fr', 'en']} primaryLanguage="en" readOnly={false} />
    </QueryClientProvider>);
    const view = mount();
    fireEvent.click(await screen.findByText('Families', { selector: 'summary' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title · English' }), { target: { value: 'New session title' } });
    fireEvent.click(screen.getByLabelText('Include on Home'));
    fireEvent.change(screen.getByLabelText('Session photo'), { target: { files: [new File(['photo'], 'family.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText('Session photo saved.');
    expect(screen.queryByText('Session saved.')).toBeNull();
    view.unmount(); mount();
    fireEvent.click(await screen.findByText('Families', { selector: 'summary' }));
    expect(screen.getByRole('textbox', { name: 'Title · English' })).toHaveProperty('value', 'New session title');
    expect(screen.getByLabelText('Include on Home')).toHaveProperty('checked', false);
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));
    await waitFor(() => expect(card.copy?.en.title).toBe('New session title'));
    await screen.findByText('Session saved.');
    expect(leavingIsPrevented()).toBe(false);
  });

  it('clears the new-session draft before successful creation unmounts its editor', async () => {
    await i18n.changeLanguage('en');
    const cards: ReturnType<typeof ServiceCardSchema.parse>[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && typeof init.body === 'string') {
        const created = ServiceCardSchema.parse({ id: 'new-session', isBuiltin: false, sortOrder: 0,
          enabled: false, showOnHome: false, imageRevision: null, imageSources: [], copy: JSON.parse(init.body) as unknown });
        cards.push(created);
        return Promise.resolve(Response.json(created));
      }
      return Promise.resolve(Response.json(cards));
    }));
    render(<QueryClientProvider client={new QueryClient()}>
      <ServiceCatalogEditor enabledLanguages={['fr', 'en']} primaryLanguage="en" readOnly={false} />
    </QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a session' }));
    for (const label of ['Title', 'Short Home description', 'Session description']) {
      fireEvent.change(screen.getByRole('textbox', { name: `${label} · English` }), { target: { value: `New ${label}` } });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Translations: ${label}`) }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'French' }), { target: { value: `Nouveau ${label}` } });
      fireEvent.keyDown(dialog, { key: 'Escape' });
    }
    expect(leavingIsPrevented()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    await screen.findByRole('button', { name: 'Add a session' });
    expect(leavingIsPrevented()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add a session' }));
    const newEditor = document.querySelector('.admin-service-catalog > .admin-service-editor');
    expect(newEditor).not.toBeNull();
    expect(within(newEditor as HTMLElement).getByRole('textbox', { name: 'Title · English' })).toHaveProperty('value', '');
  });
});
