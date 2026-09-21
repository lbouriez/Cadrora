import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '../components';
import { useTheme } from '../useTheme';

export interface AdminLayoutProps {
  children: ReactNode;
  onLogout?: () => void;
  readOnly?: boolean;
  subject?: string;
}

/** Shared admin frame with keyboard skip navigation and local theme/language controls. */
export function AdminLayout({ children, onLogout, readOnly = false, subject }: AdminLayoutProps) {
  const { i18n, t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const switchLanguage = () => {
    void i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr');
  };

  return (
    <div className="admin-shell">
      <a className="admin-shell__skip" href="#admin-main">{t('admin.skipToContent')}</a>
      <div className="admin-shell__frame">
        <header className="admin-shell__header">
          <NavLink className="admin-shell__brand" to="/admin">Cadrora</NavLink>
          <div className="admin-shell__controls">
            <Button aria-label={t('admin.language')} onClick={switchLanguage} variant="secondary">
              {t('admin.language')}
            </Button>
            <Button
              aria-label={theme === 'dark' ? t('admin.themeLight') : t('admin.theme')}
              onClick={toggleTheme}
              variant="secondary"
            >
              {theme === 'dark' ? t('admin.themeLight') : t('admin.theme')}
            </Button>
            {subject ? <span className="admin-shell__identity">{t('admin.signedInAs', { subject })}</span> : null}
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
