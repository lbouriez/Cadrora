// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { ContactPage } from '../../../src/app/public/InfoPage';
import { PrivacyPage } from '../../../src/app/public/InfoPage';
import { HomePage } from '../../../src/app/public/HomePage';
import { AboutPage } from '../../../src/app/public/AboutPage';
import { PublicEventCards } from '../../../src/app/public/PublicEventCards';
import { installFindResources } from '../../../src/app/public/FindI18n';
import { installPublicResources, publicResources } from '../../../src/app/public/i18n';

const runtimeSettings = {
  siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
  contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
  map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
  enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'both',
  homeGalleries: { enabled: true, limit: 6 },
  homeServicesLimit: 3,
  updatedAt: '2026-09-26T00:00:00.000Z',
};

function publicGallery(id: string, title: string, startsAt: string, createdAt: string) {
  return {
    id, slug: id, title, description: null, service: null, startsAt, timezone: 'America/Toronto',
    coverPhotoId: null, visibility: 'published' as const, access: 'public' as const, allowDownloads: false,
    faceSearchEnabled: false, nearbySearchEnabled: false, showPhotoMetadata: false,
    retouchSelectionEnabled: false, retentionDays: null, revision: 1,
    createdAt, updatedAt: createdAt, coverPhotoUrl: null,
  };
}

beforeAll(() => {
  installPublicResources(i18n);
  installFindResources(i18n);
});

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fr');
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderPage(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('public photographer website', () => {
  it('speaks to visitors in the site owner’s voice in both languages', async () => {
    expect(i18n.t('gallery.protectedHelp')).toBe('Entrez le mot de passe qui vous a été transmis.');
    expect(i18n.t('gallery.privacyPage.operator.body', { siteName: 'Studio Exemple' })).toContain('Studio Exemple');
    expect(JSON.stringify(publicResources)).not.toMatch(/\b(?:photographer|photographe)\b/i);

    await i18n.changeLanguage('en');
    expect(i18n.t('gallery.protectedHelp')).toBe('Enter the password you were given.');
    expect(i18n.t('gallery.privacyPage.operator.body', { siteName: 'Example Studio' })).toContain('Example Studio');
  });

  it('keeps the showcase content useful when the gallery API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    renderPage(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Vos moments préférés. Plus faciles à retrouver.' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Des photos qui vous ressemblent.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retrouver des photos avec l’IA' }).getAttribute('href')).toBe('/e/find-your-photos/find');
    const atelierLink = screen.getByRole('link', { name: /Atelier Giulia.*Visiter le site/u });
    expect(atelierLink.getAttribute('href')).toBe('https://ateliergiulia.com/');
    expect(atelierLink.getAttribute('rel')).toBe('noopener');
    await waitFor(() => expect(screen.getByText(/galeries ne sont pas disponibles pour le moment/i)).toBeTruthy());
  });

  it('hides About from shared navigation when the owner disables the page', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site' ? { ...runtimeSettings, aboutEnabled: false }
        : { events: [], protectedGalleries: [], nextCursor: null },
    ), { status: 200 }))));
    renderPage(<HomePage />);
    await waitFor(() => expect(screen.queryByRole('link', { name: 'À propos' })).toBeNull());
  });

  it('renders owner-managed About text in the Cadrora presentation', async () => {
    const aboutCopy = {
      fr: { title: 'Rencontrez Anna', body: 'Je photographie les familles.', imageAlt: 'Anna au studio' },
      en: { title: 'Meet Anna', body: 'I photograph families.', imageAlt: 'Anna in her studio' },
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ ...runtimeSettings, aboutEnabled: true,
      aboutCopy, aboutImageRevision: 2, aboutImageMediumWidth: 1280, aboutImageLargeWidth: 2560 }))));
    renderPage(<AboutPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rencontrez Anna' })).toBeTruthy());
    expect(screen.getByText('Je photographie les familles.')).toBeTruthy();
    fireEvent.load(screen.getByRole('img', { name: 'Anna au studio' }));
    await waitFor(() => expect(document.querySelector('.about-page__image img[srcset]')?.getAttribute('srcset'))
      .toContain('/about-hero-image/large 2560w'));
  });

  it('renders owner-edited name, bilingual footer, and browser description', async () => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site' ? {
        ...runtimeSettings,
        constructionNoticeEnabled: true,
        siteName: 'Studio Boréal',
        siteCopy: {
          fr: { description: 'Portraits du Québec.', footerTagline: 'Des histoires à garder.' },
          en: { description: 'Portraits from Québec.', footerTagline: 'Stories to keep.' },
        },
      } : { events: [], protectedGalleries: [], nextCursor: null },
    ), { status: 200 }))));
    renderPage(<HomePage />);

    await waitFor(() => expect(screen.getByText('© Studio Boréal · Des histoires à garder.')).toBeTruthy());
    expect(document.querySelector('.public-construction-notice')?.textContent).toBe('Notre site est en préparation. Merci de votre patience.');
    expect(screen.getByText('© Studio Boréal · Des histoires à garder.')).toBeTruthy();
    expect(document.title).toBe('Studio Boréal');
    expect(meta.content).toBe('Portraits du Québec.');

    fireEvent.click(screen.getByRole('button', { name: 'Afficher en EN' }));
    await waitFor(() => expect(screen.getByText('© Studio Boréal · Stories to keep.')).toBeTruthy());
    expect(document.querySelector('.public-construction-notice')?.textContent).toBe('Our site is in progress. Thank you for your patience.');
    await waitFor(() => expect(meta.content).toBe('Portraits from Québec.'));
    meta.remove();
  });

  it('shows only the configured number of newest event dates on the home page', async () => {
    const galleries = [
      publicGallery('older', 'Older event', '2020-01-01T12:00:00.000Z', '2026-09-26T03:00:00.000Z'),
      publicGallery('newer', 'Newer event', '2022-01-01T12:00:00.000Z', '2026-09-26T01:00:00.000Z'),
      publicGallery('middle', 'Middle event', '2021-01-01T12:00:00.000Z', '2026-09-26T02:00:00.000Z'),
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site'
        ? { ...runtimeSettings, homeGalleries: { enabled: true, limit: 2 } }
        : { events: galleries, protectedGalleries: [], nextCursor: null },
    ), { status: 200 }))));
    renderPage(<HomePage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Newer event' })).toBeTruthy());
    const titles = [...document.querySelectorAll('.event-card h3')].map((title) => title.textContent);
    expect(titles).toEqual(['Newer event', 'Middle event']);
  });

  it('shows the first three of seven Home-eligible services in admin order', async () => {
    const cards = Array.from({ length: 7 }, (_, index) => ({
      id: `custom-${index}`, isBuiltin: false, sortOrder: index, enabled: true, showOnHome: true,
      copy: {
        fr: { title: `Service ${index}`, shortDescription: `Résumé ${index}`, description: `Description ${index}`, points: [] },
        en: { title: `Service ${index}`, shortDescription: `Summary ${index}`, description: `Description ${index}`, points: [] },
      },
      imageRevision: 1,
      imageSources: [{ url: `/service-media/custom-${index}/1/preview`, width: 320, height: 213 }],
    }));
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site' ? { ...runtimeSettings, homeServicesLimit: 3, homeGalleries: { enabled: false, limit: 6 } }
        : url === '/api/v1/services' ? cards : { events: [], protectedGalleries: [], nextCursor: null },
    ), { status: 200 }))));
    renderPage(<HomePage />);

    await waitFor(() => expect([...document.querySelectorAll('.service-card h3')].map((title) => title.textContent))
      .toEqual(['Service 0', 'Service 1', 'Service 2']));
    expect(screen.getByText('Résumé 0')).toBeTruthy();
  });

  it('uses the Home introduction from the existing site response and keeps the photo URL available immediately', async () => {
    const homeHeroCopy = {
      fr: { label: 'Moments choisis', title: 'Votre lumière', description: 'Des images pour votre histoire.', caption: '', imageAlt: 'Portrait au soleil' },
      en: { label: 'Chosen moments', title: 'Your light', description: 'Images for your story.', caption: '', imageAlt: 'Sunlit portrait' },
      buttons: [
        { labels: { fr: 'Parlons-en', en: 'Get in touch' }, href: '/contact', variant: 'primary' },
        { labels: { fr: 'Services', en: 'Services' }, href: '/services', variant: 'secondary' },
        { labels: { fr: 'Galeries', en: 'Galleries' }, href: '/galleries', variant: 'primary' },
      ],
    };
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site' ? { ...runtimeSettings, homeHeroCopy, homeHeroImageRevision: 2,
        homeHeroImageMediumWidth: 1280, homeHeroImageLargeWidth: 2560, homeGalleries: { enabled: false, limit: 6 } } : [],
    ), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(<HomePage />);

    expect(document.querySelector('.site-hero__art img')?.getAttribute('srcset')).toContain('/home-hero-image/medium 960w');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Votre lumière' })).toBeTruthy());
    expect(document.querySelector('.site-hero__art img')?.getAttribute('srcset'))
      .toContain('/home-hero-image/medium 1280w, /home-hero-image/large 2560w');
    expect(screen.getByRole('img', { name: 'Portrait au soleil' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Parlons-en' }).getAttribute('href')).toBe('/contact');
    expect(document.querySelector('.site-hero .site-actions a[href="/galleries"]')?.className).toContain('button--primary');
    expect(document.querySelectorAll('.site-hero .site-actions .button')).toHaveLength(3);
    expect(document.querySelector('.site-hero__art figcaption')).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/site')).toHaveLength(1);
  });

  it('interleaves public and protected cards by event date in the full directory', () => {
    renderPage(<PublicEventCards
      events={[
        publicGallery('recent-public', 'Recent public', '2022-01-01T12:00:00.000Z', '2026-09-26T01:00:00.000Z'),
        publicGallery('old-public', 'Old public', '2020-01-01T12:00:00.000Z', '2026-09-26T03:00:00.000Z'),
      ]}
      language="fr"
      protectedGalleries={[{
        id: 'middle-private', slug: 'middle-private', title: 'Middle private', description: null,
        startsAt: '2021-01-01T12:00:00.000Z', createdAt: '2026-09-26T04:00:00.000Z', service: null,
      }]}
    />);
    expect([...document.querySelectorAll('.event-card h3')].map((title) => title.textContent))
      .toEqual(['Recent public', 'Middle private', 'Old public']);
  });

  it('hides home stories and keeps the gallery call to action usable', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site'
        ? { ...runtimeSettings, homeGalleries: { enabled: false, limit: 2 } }
        : { events: [], protectedGalleries: [], nextCursor: null },
    ), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(<HomePage />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Galeries' })).toBeNull());
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('/api/v1/galleries?access=public&limit=12');
    expect(screen.getByRole('link', { name: 'Explorer les galeries en ligne' }).getAttribute('href')).toBe('/galleries');
  });

  it('uses the portfolio as the public destination when the gallery directory is hidden', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url === '/api/v1/site'
        ? { ...runtimeSettings, galleryDirectoryEnabled: false }
        : { events: [], protectedGalleries: [], nextCursor: null },
    ), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(<HomePage />);

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Galeries' })).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Galeries' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Retrouver des photos avec l’IA' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Découvrir le portfolio' }).some((link) => link.getAttribute('href') === '/portfolio')).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('/api/v1/galleries?access=public&limit=12');
  });

  it('renders contact details supplied by D1 without a demo disclaimer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteName: 'Atelier Cadrora', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
      contactEmail: 'studio@runtime.example', contactPhone: '+1 438 555-0199',
      contactAddress: '456 rue du Studio, Québec', serviceArea: 'Québec et Charlevoix',
      enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'both',
      homeGalleries: { enabled: true, limit: 6 },
      homeServicesLimit: 3,
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      updatedAt: '2026-09-23T00:00:00.000Z',
    }), { headers: { 'content-type': 'application/json' }, status: 200 })));
    renderPage(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Créons quelque chose de mémorable.' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('link', { name: 'studio@runtime.example' })).toBeTruthy());
    expect(screen.getByRole('link', { name: '+1 438 555-0199' })).toBeTruthy();
    expect(screen.getByText('456 rue du Studio, Québec')).toBeTruthy();
    expect(screen.queryByText(/coordonnées sont fictives/i)).toBeNull();
  });

  it('explains gallery privacy choices in the shared notice', () => {
    renderPage(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: 'Retrouver vos photos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Durée de conservation' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mesure des visites et carte' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Qui gère ce site' })).toBeTruthy();
    expect(screen.getByText(/Cette politique concerne Cadrora/)).toBeTruthy();
  });

  it('uses natural singular and plural labels for photo results in both languages', async () => {
    expect(i18n.t('faceFind.resultCount', { count: 1 })).toBe('1 photo possible trouvée dans cette galerie.');
    expect(i18n.t('faceFind.nearbyFound', { count: 2 })).toContain('2 autres photos');
    expect(i18n.t('gallery.downloadSelection.count', { count: 1 })).toBe('1 photo sélectionnée');
    expect(i18n.t('gallery.downloadSelection.count', { count: 0 })).toBe('0 photo sélectionnée');

    await i18n.changeLanguage('en');
    expect(i18n.t('faceFind.resultCount', { count: 1 })).toBe('1 possible photo found in this gallery.');
    expect(i18n.t('faceFind.nearbyFound', { count: 2 })).toContain('2 more photos');
    expect(i18n.t('gallery.downloadSelection.count', { count: 1 })).toBe('1 photo selected');
  });
});
