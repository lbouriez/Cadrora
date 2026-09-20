import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { siteProfile } from './siteProfile';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const nextLanguage = i18n.resolvedLanguage?.startsWith('fr') ? 'en' : 'fr';

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link aria-label={t('gallery.home')} className="public-brand" to="/">
          <img alt="" height="1600" src="/brand/cadrora-logo.png" width="1600" />
          <span>{siteProfile.siteName}</span>
        </Link>
        <nav aria-label={t('gallery.primaryNavigation')} className="public-nav">
          <Link to="/">{t('gallery.home')}</Link>
          <Link to="/#services">{t('gallery.services')}</Link>
          <Link to="/#galleries">{t('gallery.events')}</Link>
          <Link to="/contact">{t('gallery.contact')}</Link>
          <button
            aria-label={t('gallery.changeLanguage', { language: nextLanguage.toUpperCase() })}
            className="public-language"
            onClick={() => { void i18n.changeLanguage(nextLanguage); }}
            type="button"
          >
            {nextLanguage.toUpperCase()}
          </button>
        </nav>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        <p>{t('gallery.footer', { siteName: siteProfile.siteName })}</p>
        <nav aria-label={t('gallery.footerNavigation')}>
          <Link to="/privacy">{t('gallery.privacy')}</Link>
          <Link to="/contact">{t('gallery.contact')}</Link>
        </nav>
      </footer>
    </div>
  );
}
