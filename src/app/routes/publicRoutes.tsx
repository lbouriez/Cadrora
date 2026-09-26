/* eslint-disable react-refresh/only-export-components -- route configuration is consumed by the root router. */
import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { i18n } from '../i18n';
import { ContactPage, PrivacyPage } from '../public/InfoPage';
import { faceFindRouteObject, installFaceFindResources } from '../public/FindRoute';
import { HomePage } from '../public/HomePage';
import { PublicRouteFallback } from '../public/PublicRouteFallback';
import { installPublicResources } from '../public/i18n';
import { GalleriesPage, ServicesPage } from '../public/ShowcasePages';
import '../public/public.css';

installPublicResources(i18n);
installFaceFindResources();

const GalleryPage = lazy(async () => ({ default: (await import('../public/GalleryPage')).GalleryPage }));
const galleryElement = <Suspense fallback={<PublicRouteFallback />}><GalleryPage /></Suspense>;

export const publicRouteObjects: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/services', element: <ServicesPage /> },
  { path: '/galleries', element: <GalleriesPage /> },
  { path: '/e/:slug', element: galleryElement },
  { path: '/e/:slug/photo/:photoId', element: galleryElement },
  faceFindRouteObject,
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/contact', element: <ContactPage /> },
];

export { ContactPage, GalleriesPage, HomePage, PrivacyPage, ServicesPage };
