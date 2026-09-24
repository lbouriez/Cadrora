import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoutes } from 'react-router-dom';

import { publicRouteObjects } from './routes/publicRoutes';
import { Spinner } from './components';

const AdminDashboardRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminDashboardRoute }));
const AdminEventSettingsRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminEventSettingsRoute }));
const AdminImportRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminImportRoute }));
const AdminFavoritesRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminFavoritesRoute }));
const AdminLoginRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminLoginRoute }));
const AdminSiteSettingsRoute = lazy(async () => ({ default: (await import('./admin/AdminRoutes')).AdminSiteSettingsRoute }));

function adminElement(element: ReactNode) {
  return <Suspense fallback={<main className="admin-login"><Spinner label="Cadrora" /></main>}>{element}</Suspense>;
}

function FoundationShell() {
  const { t } = useTranslation();

  return (
    <main className="app-shell">
      <section className="app-shell__content">
        <img
          alt={t('app.brandAlt')}
          className="app-shell__logo"
          height="1600"
          src="/brand/cadrora-logo.png"
          width="1600"
        />
        <p className="app-shell__eyebrow">{t('app.eyebrow')}</p>
        <h1 className="app-shell__title">{t('app.title')}</h1>
        <p className="app-shell__status">{t('app.foundationReady')}</p>
      </section>
    </main>
  );
}

export function App() {
  return useRoutes([
    { path: '/admin/login', element: adminElement(<AdminLoginRoute />) },
    { path: '/admin', element: adminElement(<AdminDashboardRoute />) },
    { path: '/admin/settings', element: adminElement(<AdminSiteSettingsRoute />) },
    { path: '/admin/galleries/:eventId', element: adminElement(<AdminEventSettingsRoute />) },
    { path: '/admin/galleries/:eventId/import', element: adminElement(<AdminImportRoute />) },
    { path: '/admin/galleries/:eventId/selections', element: adminElement(<AdminFavoritesRoute />) },
    ...publicRouteObjects,
    { path: '*', element: <FoundationShell /> },
  ]);
}
