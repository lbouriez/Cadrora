/* eslint-disable react-refresh/only-export-components -- route configuration is consumed by the root router. */
import type { RouteObject } from 'react-router-dom';

import { i18n } from '../i18n';
import { ContactPage, PrivacyPage } from '../public/InfoPage';
import { faceFindRouteObject, installFaceFindResources } from '../public/FindRoute';
import { GalleryPage } from '../public/GalleryPage';
import { HomePage } from '../public/HomePage';
import { installPublicResources } from '../public/i18n';
import { EventsPage, ServicesPage } from '../public/ShowcasePages';
import '../public/public.css';

installPublicResources(i18n);
installFaceFindResources();

export const publicRouteObjects: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/services', element: <ServicesPage /> },
  { path: '/events', element: <EventsPage /> },
  { path: '/e/:slug', element: <GalleryPage /> },
  { path: '/e/:slug/photo/:photoId', element: <GalleryPage /> },
  faceFindRouteObject,
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/contact', element: <ContactPage /> },
];

export { ContactPage, EventsPage, GalleryPage, HomePage, PrivacyPage, ServicesPage };
