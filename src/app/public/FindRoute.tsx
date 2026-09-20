/* eslint-disable react-refresh/only-export-components -- isolated route and resource integration hook. */
import type { RouteObject } from 'react-router-dom';

import { i18n } from '../i18n';
import { FindPage } from './FindPage';
import { installFindResources } from './FindI18n';
import './find.css';

export function installFaceFindResources(): void {
  installFindResources(i18n);
}

export const faceFindRouteObject: RouteObject = {
  path: '/e/:slug/find',
  element: <FindPage />,
};

export { FindPage };
