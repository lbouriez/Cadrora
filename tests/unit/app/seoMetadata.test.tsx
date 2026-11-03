// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminLoginPage } from '../../../src/app/admin/AdminLoginPage';
import { i18n } from '../../../src/app/i18n';
import { PortfolioDetailPage } from '../../../src/app/public/PortfolioPage';
import { PublicLayout } from '../../../src/app/public/PublicLayout';
import { installPublicResources } from '../../../src/app/public/i18n';
import { siteProfile } from '../../../src/app/public/siteProfile';

const settings = {
  siteName: 'Studio Boréal', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'both',
  homeGalleries: { enabled: false, limit: 6 }, updatedAt: '2026-11-03T00:00:00.000Z',
};

function collection(slug: string, hasCover = true) {
  return { id: slug, slug, categoryId: 'family', sortOrder: 0, published: true, coverPhotoId: `${slug}-owner-cover`,
    copy: { fr: { title: 'Famille', description: 'Portraits' }, en: { title: 'Family', description: 'Portraits' } },
    // Equal dimensions deliberately make "last source" unreliable; the server shares the large variant.
    coverSources: hasCover ? ['large', 'small'].map((variant) => ({ url: `/portfolio-media/${slug}-owner-cover/${variant}`, width: 480, height: 320 })) : [],
    photoCount: 0, photos: [],
  };
}

const image = () => document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
const twitterImage = () => document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content;
const fallbackImage = new URL(siteProfile.shareImageUrl, siteProfile.seoOrigin ?? undefined).href;

beforeAll(() => installPublicResources(i18n));
beforeEach(() => { localStorage.clear(); document.head.innerHTML = '<title>Home</title>'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(path: string, language: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <nav><Link to={`/${language}/portfolio/second/`}>Second collection</Link>
      <Link to={`/${language}/`}>Home test</Link><Link to="/admin/login?demo=1">Login test</Link></nav>
    <Routes>
      <Route path="/:language/portfolio/:slug" element={<PortfolioDetailPage />} />
      <Route path="/:language" element={<PublicLayout><h1>Home test</h1></PublicLayout>} />
      <Route path="/admin/login" element={<AdminLoginPage requestTurnstileToken={() => Promise.resolve('')} />} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
}

describe('page metadata ownership', () => {
  it.each(['fr', 'en'])('retains the server cover while loading and follows collection/home/login navigation in %s', async (language) => {
    await i18n.changeLanguage(language);
    const initialImage = 'https://cadrora.com/portfolio-media/first-owner-cover/large';
    document.head.innerHTML += `<meta name="description" content="Home"><link rel="canonical" href="https://cadrora.com/${language}/portfolio/first/">
      <meta property="og:image" content="${initialImage}"><meta name="twitter:image" content="${initialImage}">`;
    let resolveFirst: (value: Response) => void = () => { throw new Error('Request not started'); };
    const firstResponse = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/v1/site' ? Promise.resolve(Response.json({ ...settings, defaultLanguage: language }))
      : url === '/api/v1/portfolio/first' ? firstResponse
      : Promise.resolve(Response.json(url === '/api/v1/portfolio/second' ? collection('second') : []))));
    mount(`/${language}/portfolio/first/`, language);
    await waitFor(() => expect(document.title).toContain('Studio Boréal'));
    expect(image()).toBe(initialImage);
    expect(twitterImage()).toBe(initialImage);
    resolveFirst(Response.json(collection('first')));
    await screen.findByRole('heading', { name: language === 'fr' ? 'Famille' : 'Family' });
    expect(image()).toBe(initialImage);
    expect(twitterImage()).toBe(initialImage);
    const organization: unknown = JSON.parse(document.querySelector('#site-organization')?.textContent ?? 'null');
    expect(organization).toMatchObject({ image: fallbackImage });
    fireEvent.click(screen.getByRole('link', { name: 'Second collection' }));
    await waitFor(() => expect(image()).toBe('https://cadrora.com/portfolio-media/second-owner-cover/large'));
    expect(twitterImage()).toBe(image());
    fireEvent.click(screen.getByRole('link', { name: 'Home test' }));
    await waitFor(() => expect(image()).toBe(fallbackImage));
    fireEvent.click(screen.getByRole('link', { name: 'Login test' }));
    await waitFor(() => expect(document.title).toBe(`${language === 'fr' ? 'Connexion photographe' : 'Photographer sign in'} | Studio Boréal`));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"], link[hreflang], meta[property^="og:"], meta[name^="twitter:"], #site-organization')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Home test' }));
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow'));
    expect(image()).toBe(fallbackImage);
  });

  it.each([false, true])('uses the fallback for an empty collection, preserves initial cover on API failure=%s', async (failed) => {
    await i18n.changeLanguage('fr');
    const initialImage = 'https://cadrora.com/portfolio-media/first-owner-cover/large';
    document.head.innerHTML += `<link rel="canonical" href="https://cadrora.com/fr/portfolio/first/"><meta property="og:image" content="${initialImage}">`;
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === '/api/v1/site' ? Response.json(settings)
      : url === '/api/v1/portfolio/first' ? failed ? new Response(null, { status: 503 }) : Response.json(collection('first', false))
      : Response.json([]))));
    mount('/fr/portfolio/first/', 'fr');
    if (failed) await screen.findByRole('alert');
    else await screen.findByRole('heading', { name: 'Famille' });
    expect(image()).toBe(failed ? initialImage : fallbackImage);
  });
});
