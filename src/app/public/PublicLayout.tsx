import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { IconButton } from '../components';
import { openPrivacyPreferences } from './consent';
import { GoogleAnalytics } from './GoogleAnalytics';
import { PrivacyConsent } from './PrivacyConsent';
import { PublicConstructionNotice } from './PublicConstructionNotice';
import { siteProfile } from './siteProfile';
import { getPublicSiteSettings } from './api';
import { useTheme } from '../useTheme';
import { rememberVisitorLanguage } from '../i18n/visitorLanguage';
import type { NavigationItem } from '../site/types';

export function PublicLayout({ children, fullBleed = false, pageDescription, pageTitle, wide = false }: {
  children: ReactNode; fullBleed?: boolean; pageDescription?: string; pageTitle?: string; wide?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const immersiveHome = siteProfile.home.presentation === 'session-slides' && pathname === '/';
  const nextLanguage = i18n.resolvedLanguage?.startsWith('fr') ? 'en' : 'fr';
  const settings = useQuery({
    queryFn: getPublicSiteSettings,
    queryKey: ['public-site-settings'],
    retry: false,
    staleTime: 60_000,
  });
  // Until D1 resolves, keep the static light shell and hide controls whose policy is unknown.
  const themePolicy = settings.isPending ? 'light' : settings.data?.themeMode ?? 'both';
  const { canChooseTheme, theme, toggleTheme } = useTheme(themePolicy);
  const enabledLanguages = settings.data?.enabledLanguages ?? ['fr', 'en'];
  const canChooseLanguage = enabledLanguages.length > 1;
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const siteName = settings.data?.siteName ?? siteProfile.siteName;
  const description = settings.data?.siteCopy?.[language].description ?? siteProfile.siteDescription[language];
  const footerTagline = settings.data?.siteCopy?.[language].footerTagline ?? t('gallery.footerTagline');
  const galleryDirectoryEnabled = settings.data?.galleryDirectoryEnabled ?? true;
  const navigation: readonly NavigationItem[] = siteProfile.navigation ?? ['home', 'services', 'portfolio', 'galleries', 'about', 'contact'];
  const navigationTarget: Record<NavigationItem, { href: string; label: string }> = {
    home: { href: '/', label: t('gallery.home') },
    portfolio: { href: '/portfolio', label: t('gallery.portfolio') },
    services: { href: '/services', label: t('gallery.services') },
    galleries: { href: '/galleries', label: t('gallery.events') },
    about: { href: '/about', label: t('gallery.about') },
    contact: { href: '/contact', label: t('gallery.contact') },
  };

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

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | ${siteName}` : siteName;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', pageDescription || description);
  }, [description, pageDescription, pageTitle, siteName]);

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta');
    if (!robots.parentNode) {
      robots.name = 'robots';
      document.head.append(robots);
    }
    robots.content = pathname === '/galleries' || pathname.startsWith('/e/') ? 'noindex,nofollow' : 'index,follow';
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    if (siteProfile.home.presentation !== 'session-slides') {
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    const mobile = window.matchMedia('(max-width: 54rem)');
    const content = document.querySelectorAll<HTMLElement>('.public-main, .public-footer');
    const previousOverflow = document.body.style.overflow;
    const previousInert = [...content].map((element) => element.inert);
    const syncMenu = () => {
      document.body.style.overflow = mobile.matches ? 'hidden' : previousOverflow;
      content.forEach((element, index) => { element.inert = mobile.matches || previousInert[index] === true; });
    };
    syncMenu();
    if (mobile.matches) document.querySelector<HTMLAnchorElement>('#public-navigation a')?.focus();
    mobile.addEventListener('change', syncMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      mobile.removeEventListener('change', syncMenu);
      document.body.style.overflow = previousOverflow;
      content.forEach((element, index) => { element.inert = previousInert[index] === true; });
    };
  }, [menuOpen]);

  return (
    <div className={`public-shell${immersiveHome ? ' public-shell--immersive' : ''}${pathname === '/contact' ? ' public-shell--contact' : ''}${menuOpen ? ' public-shell--menu-open' : ''}`}>
      {settings.data?.constructionNoticeEnabled ? <PublicConstructionNotice /> : null}
      <header className="public-header">
        <Link aria-label={t('gallery.home')} className="public-brand" onClick={() => setMenuOpen(false)} to="/">
          {siteProfile.logoUrl ? <img alt="" height="256" src={siteProfile.logoUrl} width="256" /> : null}
          <span>{siteName}</span>
        </Link>
        <div className="public-header__actions">
          <nav aria-label={t('gallery.primaryNavigation')} className={`public-nav${menuOpen ? ' public-nav--open' : ''}`} id="public-navigation">
            {navigation.filter((item) => (item !== 'galleries' || galleryDirectoryEnabled)
              && (item !== 'about' || (settings.data?.aboutEnabled ?? true))).map((item) => (
              <NavLink end={item === 'home'} key={item} onClick={() => setMenuOpen(false)}
                to={navigationTarget[item].href}>{navigationTarget[item].label}</NavLink>
            ))}
          </nav>
          <div className="public-header__controls">
          <button
            aria-controls="public-navigation"
            aria-expanded={menuOpen}
            aria-label={t(menuOpen ? 'gallery.closeMenu' : 'gallery.openMenu')}
            className="public-header__menu"
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuButton}
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
            onClick={() => { rememberVisitorLanguage(nextLanguage); void i18n.changeLanguage(nextLanguage); }}
            title={t('gallery.changeLanguage', { language: nextLanguage.toUpperCase() })}
          >
            {nextLanguage.toUpperCase()}
          </IconButton> : null}
          </div>
        </div>
      </header>
      <main className={`public-main${wide ? ' public-main--gallery' : ''}${fullBleed || immersiveHome ? ' public-main--immersive' : ''}`}>{children}</main>
      <footer className="public-footer">
        <div className="public-footer__identity">
          <div className="public-footer__signature">
            <p>© {siteName}{footerTagline ? ` · ${footerTagline}` : ''}</p>
            {!siteProfile.demo.enabled ? (
              <a className="public-footer__credit" href="https://cadrora.com/">
                <span>{t('gallery.footerCredit')} </span>
                <img alt="" height="256" src="/brand/cadrora-logo.png" width="256" />
                <span>Cadrora</span>
              </a>
            ) : null}
          </div>
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
