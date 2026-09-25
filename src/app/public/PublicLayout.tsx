import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { IconButton } from '../components';
import { openPrivacyPreferences } from './consent';
import { GoogleAnalytics } from './GoogleAnalytics';
import { PrivacyConsent } from './PrivacyConsent';
import { siteProfile } from './siteProfile';
import { getPublicSiteSettings } from './api';
import { useTheme } from '../useTheme';

export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { i18n, t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const nextLanguage = i18n.resolvedLanguage?.startsWith('fr') ? 'en' : 'fr';
  const settings = useQuery({
    queryFn: getPublicSiteSettings,
    queryKey: ['public-site-settings'],
    retry: false,
    staleTime: 60_000,
  });
  const { canChooseTheme, theme, toggleTheme } = useTheme(settings.data?.themeMode ?? 'both');
  const enabledLanguages = settings.data?.enabledLanguages ?? ['fr', 'en'];
  const canChooseLanguage = enabledLanguages.length > 1;

  useEffect(() => {
    if (!settings.data?.defaultLanguage) return;
    if (settings.data.enabledLanguages.length === 1) {
      void i18n.changeLanguage(settings.data.enabledLanguages[0]);
      return;
    }
    try {
      const saved = localStorage.getItem('cadrora-language');
      if (saved && settings.data.enabledLanguages.includes(saved as 'en' | 'fr')) return;
    } catch {
      // The runtime default still applies when preference storage is blocked.
    }
    void i18n.changeLanguage(settings.data.defaultLanguage);
  }, [i18n, settings.data]);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link aria-label={t('gallery.home')} className="public-brand" onClick={() => setMenuOpen(false)} to="/">
          {siteProfile.logoUrl ? <img alt="" height="1600" src={siteProfile.logoUrl} width="1600" /> : null}
          <span>{settings.data?.siteName ?? siteProfile.siteName}</span>
        </Link>
        <div className="public-header__actions">
          <nav aria-label={t('gallery.primaryNavigation')} className={`public-nav${menuOpen ? ' public-nav--open' : ''}`} id="public-navigation">
            <NavLink end onClick={() => setMenuOpen(false)} to="/">{t('gallery.home')}</NavLink>
            <NavLink onClick={() => setMenuOpen(false)} to="/services">{t('gallery.services')}</NavLink>
            <NavLink onClick={() => setMenuOpen(false)} to="/galleries">{t('gallery.events')}</NavLink>
            <NavLink onClick={() => setMenuOpen(false)} to="/contact">{t('gallery.contact')}</NavLink>
          </nav>
          <div className="public-header__controls">
          <button
            aria-controls="public-navigation"
            aria-expanded={menuOpen}
            aria-label={t(menuOpen ? 'gallery.closeMenu' : 'gallery.openMenu')}
            className="public-header__menu"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          ><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
          {canChooseTheme ? <button
            aria-label={theme === 'dark' ? t('gallery.themeLight') : t('gallery.themeDark')}
            className="public-header__theme"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('gallery.themeLight') : t('gallery.themeDark')}
            type="button"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button> : null}
          {canChooseLanguage ? <IconButton
            aria-label={t('gallery.changeLanguage', { language: nextLanguage.toUpperCase() })}
            className="public-header__language"
            onClick={() => { void i18n.changeLanguage(nextLanguage); }}
            title={t('gallery.changeLanguage', { language: nextLanguage.toUpperCase() })}
          >
            {nextLanguage.toUpperCase()}
          </IconButton> : null}
          </div>
        </div>
      </header>
      <main className={`public-main${wide ? ' public-main--gallery' : ''}`}>{children}</main>
      <footer className="public-footer">
        <div>
          <p>{t('gallery.footer', { siteName: settings.data?.siteName ?? siteProfile.siteName })}</p>
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
      <GoogleAnalytics measurementId={settings.data?.analyticsMeasurementId ?? null} />
      <PrivacyConsent analyticsAvailable={Boolean(settings.data?.analyticsMeasurementId)} />
    </div>
  );
}
