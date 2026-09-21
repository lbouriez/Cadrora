import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { openPrivacyPreferences } from './consent';
import { GoogleAnalytics } from './GoogleAnalytics';
import { PrivacyConsent } from './PrivacyConsent';
import { siteProfile } from './siteProfile';
import { getPublicSiteSettings } from './api';
import { useTheme } from '../useTheme';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const nextLanguage = i18n.resolvedLanguage?.startsWith('fr') ? 'en' : 'fr';
  const settings = useQuery({
    queryFn: getPublicSiteSettings,
    queryKey: ['public-site-settings'],
    retry: false,
    staleTime: 60_000,
  });
  const { canChooseTheme, theme, toggleTheme } = useTheme(settings.data?.themeMode ?? 'both');

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link aria-label={t('gallery.home')} className="public-brand" to="/">
          <img alt="" height="1600" src="/brand/cadrora-logo.png" width="1600" />
          <span>{siteProfile.siteName}</span>
        </Link>
        <nav aria-label={t('gallery.primaryNavigation')} className="public-nav">
          <NavLink end to="/">{t('gallery.home')}</NavLink>
          <NavLink to="/services">{t('gallery.services')}</NavLink>
          <NavLink to="/events">{t('gallery.events')}</NavLink>
          <NavLink to="/contact">{t('gallery.contact')}</NavLink>
          {canChooseTheme ? <button
            aria-label={theme === 'dark' ? t('gallery.themeLight') : t('gallery.themeDark')}
            className="public-language"
            onClick={toggleTheme}
            type="button"
          >
            {theme === 'dark' ? t('gallery.themeLight') : t('gallery.themeDark')}
          </button> : null}
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
        <div>
          <p>{t('gallery.footer', { siteName: siteProfile.siteName })}</p>
          {siteProfile.demo.enabled ? <p className="public-footer__note">{t('gallery.footerDemo')}</p> : null}
        </div>
        <nav aria-label={t('gallery.footerNavigation')}>
          <Link to="/privacy">{t('gallery.privacy')}</Link>
          <button className="public-footer__button" onClick={openPrivacyPreferences} type="button">
            {t('gallery.consent.manage')}
          </button>
          {siteProfile.demo.enabled ? <Link to="/admin/login?demo=1">{t('gallery.adminDemo')}</Link> : null}
          <Link to="/contact">{t('gallery.contact')}</Link>
        </nav>
      </footer>
      <GoogleAnalytics />
      <PrivacyConsent />
    </div>
  );
}
