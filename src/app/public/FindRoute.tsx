/* eslint-disable react-refresh/only-export-components -- isolated route and resource integration hook. */
import type { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { i18n } from '../i18n';
import { installFindResources } from './FindI18n';
import { PublicRouteFallback } from './PublicRouteFallback';

const FindPage = lazy(async () => {
  const { FindPage: page } = await import('./FindPage');
  return { default: page };
});

export function installFaceFindResources(): void {
  installFindResources(i18n);
}

export const faceFindRouteObject: RouteObject = {
  path: '/e/:slug/find',
  element: <Suspense fallback={<PublicRouteFallback />}><FindPage /></Suspense>,
};
