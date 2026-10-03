/* eslint-disable react-refresh/only-export-components -- route configuration is consumed by the root router. */
import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { i18n } from '../i18n';
import { faceFindRouteObject, installFaceFindResources } from '../public/FindRoute';
import { HomePage } from '../public/HomePage';
import { PublicRouteFallback } from '../public/PublicRouteFallback';
import { installPublicResources } from '../public/i18n';
import { SiteStartup } from '../public/SiteStartup';
import '../public/public.css';

installPublicResources(i18n);
installFaceFindResources();

const GalleryPage = lazy(async () => ({ default: (await import('../public/GalleryPage')).GalleryPage }));
const galleryElement = <Suspense fallback={<PublicRouteFallback />}><GalleryPage /></Suspense>;
const AboutPage = lazy(async () => ({ default: (await import('../public/AboutPage')).AboutPage }));
const ContactPage = lazy(async () => ({ default: (await import('../public/InfoPage')).ContactPage }));
const PrivacyPage = lazy(async () => ({ default: (await import('../public/InfoPage')).PrivacyPage }));
const PortfolioPage = lazy(async () => ({ default: (await import('../public/PortfolioPage')).PortfolioPage }));
const PortfolioDetailPage = lazy(async () => ({ default: (await import('../public/PortfolioPage')).PortfolioDetailPage }));
const GalleriesPage = lazy(async () => ({ default: (await import('../public/ShowcasePages')).GalleriesPage }));
const ServicesPage = lazy(async () => ({ default: (await import('../public/ShowcasePages')).ServicesPage }));

function marketingElement(element: React.ReactNode) {
  return <Suspense fallback={<SiteStartup />}>{element}</Suspense>;
}

const marketingRouteObjects: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/about', element: marketingElement(<AboutPage />) },
  { path: '/services', element: marketingElement(<ServicesPage />) },
  { path: '/portfolio', element: marketingElement(<PortfolioPage />) },
  { path: '/portfolio/:slug', element: marketingElement(<PortfolioDetailPage />) },
  { path: '/privacy', element: marketingElement(<PrivacyPage />) },
  { path: '/contact', element: marketingElement(<ContactPage />) },
];

export const publicRouteObjects: RouteObject[] = [
  ...marketingRouteObjects,
  ...(['fr', 'en'] as const).flatMap((language) => marketingRouteObjects.map((route) => ({
    ...route,
    path: `/${language}${route.path === '/' ? '' : route.path}`,
  }))),
  { path: '/galleries', element: marketingElement(<GalleriesPage />) },
  { path: '/e/:slug', element: galleryElement },
  { path: '/e/:slug/photo/:photoId', element: galleryElement },
  faceFindRouteObject,
];

export { ContactPage, GalleriesPage, HomePage, PrivacyPage, ServicesPage };
