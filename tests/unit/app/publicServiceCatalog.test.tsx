// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPublicServices } from '../../../src/app/public/api';
import { usePublicServiceCatalog } from '../../../src/app/public/usePublicServiceCatalog';
import { ServiceCardSchema, SiteSettingsSchema } from '../../../src/shared/schemas';
import type { SiteSettings } from '../../../src/shared/schemas/site';

vi.mock('../../../src/app/public/api', () => ({ getPublicServices: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const settings = SiteSettingsSchema.parse({
  siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['maternity'], homeGalleries: { enabled: false, limit: 6 },
  analyticsMeasurementId: null, themeMode: 'light', updatedAt: '2026-09-30T00:00:00.000Z',
});
const ownerCard = ServiceCardSchema.parse({
  id: 'maternity', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
  copy: null, imageRevision: 1,
  imageSources: [{ url: '/service-media/maternity/1/preview', width: 320, height: 320 }],
});
type SettingsRead = Pick<UseQueryResult<SiteSettings>, 'data' | 'isPending'>;

function mount(initialProps: SettingsRead, client = new QueryClient()) {
  return renderHook((props: SettingsRead) => usePublicServiceCatalog(props), {
    initialProps,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe('public session catalog loading', () => {
  it('withholds fallback cards until the owner catalog resolves, even if settings are still pending', async () => {
    let release = () => {};
    vi.mocked(getPublicServices).mockImplementation(() => new Promise((resolve) => { release = () => resolve([ownerCard]); }));
    const { result } = mount({ data: undefined, isPending: true });
    expect(result.current).toEqual({ cards: [], isPending: true });
    release();
    await waitFor(() => expect(result.current).toEqual({ cards: [ownerCard], isPending: false }));
  });

  it('waits for fallback visibility settings after the catalog fails', async () => {
    vi.mocked(getPublicServices).mockRejectedValue(new Error('Unavailable'));
    const client = new QueryClient();
    const { result, rerender } = mount({ data: undefined, isPending: true }, client);
    await waitFor(() => expect(client.getQueryState(['public-services'])?.status).toBe('error'));
    expect(result.current).toEqual({ cards: [], isPending: true });
    rerender({ data: settings, isPending: false });
    expect(result.current.isPending).toBe(false);
    expect(result.current.cards.filter((card) => card.enabled).map((card) => card.id)).toEqual(['maternity']);
  });

  it('keeps a successful empty catalog empty', async () => {
    vi.mocked(getPublicServices).mockResolvedValue([]);
    const { result } = mount({ data: settings, isPending: false });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.cards).toEqual([]);
  });

  it('keeps cached owner photos through a failed background refresh', async () => {
    vi.mocked(getPublicServices).mockRejectedValue(new Error('Unavailable'));
    const client = new QueryClient();
    client.setQueryData(['public-services'], [ownerCard], { updatedAt: 1 });
    const { result } = mount({ data: settings, isPending: false }, client);
    expect(result.current).toEqual({ cards: [ownerCard], isPending: false });
    await waitFor(() => expect(client.getQueryState(['public-services'])?.status).toBe('error'));
    expect(result.current).toEqual({ cards: [ownerCard], isPending: false });
  });
});
