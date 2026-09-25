import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components';

export interface AdminLayoutProps {
  children: ReactNode;
  onLogout?: () => void;
  readOnly?: boolean;
  subject?: string;
}

/** Shared admin frame. Public language and appearance policy live in Site settings. */
export function AdminLayout({ children, onLogout, readOnly = false, subject }: AdminLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="admin-shell">
      <a className="admin-shell__skip" href="#admin-main">{t('admin.skipToContent')}</a>
      <div className="admin-shell__frame">
        <header className="admin-shell__header">
          <NavLink className="admin-shell__brand" to="/admin">Cadrora</NavLink>
          <div className="admin-shell__controls">
            {subject ? <span className="admin-shell__identity">{t('admin.signedInAs', { subject })}</span> : null}
            <Link className="button button--secondary" to="/">{t('admin.backToSite')}</Link>
            {onLogout ? <Button onClick={onLogout} variant="secondary">{t('admin.logout')}</Button> : null}
          </div>
        </header>
        {readOnly ? <div className="admin-read-only" role="status">{t('admin.demo.readOnlyBanner')}</div> : null}
        <nav aria-label={t('admin.navigation.dashboard')} className="admin-shell__nav">
          <NavLink className="admin-shell__nav-link" end to="/admin">
            {t('admin.navigation.dashboard')}
          </NavLink>
          <NavLink className="admin-shell__nav-link" to="/admin/settings">
            {t('admin.navigation.settings')}
          </NavLink>
        </nav>
        <main id="admin-main">{children}</main>
      </div>
    </div>
  );
}
