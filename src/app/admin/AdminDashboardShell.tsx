import { useTranslation } from 'react-i18next';

import type { AdminLayoutProps } from './AdminLayout';
import { AdminLayout } from './AdminLayout';

export type AdminDashboardShellProps = Pick<AdminLayoutProps, 'onLogout' | 'subject'>;

/** Deliberately event-free dashboard shell; event operations arrive in their owning packages. */
export function AdminDashboardShell({ onLogout, subject }: AdminDashboardShellProps) {
  const { t } = useTranslation();
  const layoutProps: Pick<AdminLayoutProps, 'onLogout' | 'subject'> = {
    ...(onLogout ? { onLogout } : {}),
    ...(subject ? { subject } : {}),
  };
  return (
    <AdminLayout {...layoutProps}>
      <section className="admin-card" aria-labelledby="admin-dashboard-title">
        <h1 className="admin-card__title" id="admin-dashboard-title">{t('admin.dashboard.title')}</h1>
        <p className="admin-card__description">{t('admin.dashboard.description')}</p>
      </section>
      <section className="admin-card" aria-labelledby="admin-events-title">
        <h2 className="admin-card__title" id="admin-events-title">{t('admin.dashboard.events')}</h2>
        <p className="admin-card__description">{t('admin.dashboard.eventsDescription')}</p>
      </section>
    </AdminLayout>
  );
}
