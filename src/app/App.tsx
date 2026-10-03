import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';

import { publicRouteObjects } from './routes/publicRoutes';
import { RouteScrollReset } from './routes/RouteScrollReset';
import { Spinner } from './components';
import { siteProfile } from './public/siteProfile';
import { NotFoundPage } from './public/NotFoundPage';

const AdminGalleriesRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminGalleriesRoute }));
const AdminEventSettingsRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminEventSettingsRoute }));
const AdminImportRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminImportRoute }));
const AdminFavoritesRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminFavoritesRoute }));
const AdminLoginRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminLoginRoute }));
const AdminSiteSettingsRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminSiteSettingsRoute }));
const AdminPortfolioRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminPortfolioRoute }));
const AdminAboutRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminAboutRoute }));
const AdminWorkerErrorsRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminWorkerErrorsRoute }));

function adminElement(element: ReactNode) {
  return <Suspense fallback={<main className="admin-login"><Spinner label={siteProfile.siteName} /></main>}>{element}</Suspense>;
}

export function App() {
  const routes = useRoutes([
    { path: '/admin/login', element: adminElement(<AdminLoginRoute />) },
    { path: '/admin', element: <Navigate replace to="/admin/galleries" /> },
    { path: '/admin/galleries', element: adminElement(<AdminGalleriesRoute />) },
    { path: '/admin/settings', element: adminElement(<AdminSiteSettingsRoute />) },
    { path: '/admin/portfolio', element: adminElement(<AdminPortfolioRoute />) },
    { path: '/admin/about', element: adminElement(<AdminAboutRoute />) },
    { path: '/admin/diagnostics', element: adminElement(<AdminWorkerErrorsRoute />) },
    { path: '/admin/portfolio/:id', element: adminElement(<AdminPortfolioRoute />) },
    { path: '/admin/galleries/:eventId', element: adminElement(<AdminEventSettingsRoute />) },
    { path: '/admin/galleries/:eventId/import', element: adminElement(<AdminImportRoute />) },
    { path: '/admin/galleries/:eventId/selections', element: adminElement(<AdminFavoritesRoute />) },
    ...publicRouteObjects,
    { path: '*', element: <NotFoundPage /> },
  ]);
  return <><RouteScrollReset />{routes}</>;
}
