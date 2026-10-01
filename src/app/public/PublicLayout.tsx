import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { IconButton } from '../components';
import { openPrivacyPreferences } from './consent';
import { GoogleAnalytics } from './GoogleAnalytics';
import { PrivacyConsent } from './PrivacyConsent';
import { PublicConstructionNotice } from './PublicConstructionNotice';
import { BrandPhoto } from './BrandPhoto';
import { siteProfile } from './siteProfile';
import { getPublicSiteSettings } from './api';
import { useTheme } from '../useTheme';
import { rememberVisitorLanguage } from '../i18n/visitorLanguage';
import type { NavigationItem } from '../site/types';

export function PublicLayout({ children, fullBleed = false, immersiveFooterVisible = false, pageDescription, pageTitle, wide = false }: {
  children: ReactNode; fullBleed?: boolean; immersiveFooterVisible?: boolean; pageDescription?: string; pageTitle?: string; wide?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const routeLanguage = /^\/(fr|en)(?:\/|$)/u.exec(pathname)?.[1] as 'fr' | 'en' | undefined;
  const marketingPath = (routeLanguage ? pathname.slice(3) || '/' : pathname).replace(/\/$/u, '') || '/';
  const isPortfolioDetail = /^\/portfolio\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(marketingPath);
  const immersiveHome = siteProfile.home.presentation === 'session-slides' && marketingPath === '/';
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
  const pageKey = marketingPath === '/' ? 'home' : isPortfolioDetail ? 'portfolio'
    : (['services', 'portfolio', 'about', 'contact', 'privacy'] as const)
      .find((key) => marketingPath === `/${key}`);
  const seoCopy = pageKey ? siteProfile.seoPages?.[pageKey]?.[language] : null;
  const serviceArea = settings.data?.serviceArea?.trim() || settings.data?.contactAddress?.trim() || null;
  const localizedTarget = (path: string, selectedLanguage = language) =>
    pageKey && path !== '/galleries' ? `/${selectedLanguage}${path === '/' ? '' : path}` : path;
  const siteName = settings.data?.siteName ?? siteProfile.siteName;
  const description = settings.data?.siteCopy?.[language].description ?? siteProfile.siteDescription[language];
  const footerTagline = settings.data?.siteCopy?.[language].footerTagline ?? t('gallery.footerTagline');
  const galleryDirectoryEnabled = settings.data?.galleryDirectoryEnabled ?? true;
  const navigation: readonly NavigationItem[] = siteProfile.navigation ?? ['home', 'services', 'portfolio', 'galleries', 'about', 'contact'];
  const navigationTarget: Record<NavigationItem, { href: string; label: string }> = {
    home: { href: `/${language}`, label: t('gallery.home') },
    portfolio: { href: `/${language}/portfolio`, label: t('gallery.portfolio') },
    services: { href: `/${language}/services`, label: t('gallery.services') },
    galleries: { href: '/galleries', label: t('gallery.events') },
    about: { href: `/${language}/about`, label: t('gallery.about') },
    contact: { href: `/${language}/contact`, label: t('gallery.contact') },
  };

  useEffect(() => {
    if (!settings.data?.defaultLanguage) return;
    if (routeLanguage) {
      rememberVisitorLanguage(routeLanguage);
      void i18n.changeLanguage(routeLanguage);
      return;
    }
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
  }, [i18n, routeLanguage, settings.data]);

  useEffect(() => {
    const title = pageTitle ? `${pageTitle} | ${siteName}`
      : siteName === siteProfile.siteName ? seoCopy?.title ?? siteName : siteName;
    const ownerDescription = settings.data?.siteCopy?.[language].description;
    const summary = (pageDescription || (ownerDescription && ownerDescription !== siteProfile.siteDescription[language]
      ? ownerDescription : seoCopy?.description) || description)
      + (serviceArea && pageKey && pageKey !== 'privacy'
        ? ` ${t('gallery.seoAreaServed', { location: serviceArea })}` : '');
    document.title = title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', summary);
    const meta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      const element = document.querySelector<HTMLMetaElement>(selector) ?? document.createElement('meta');
      element.setAttribute(attribute, key);
      element.content = content;
      if (!element.parentNode) document.head.append(element);
    };
    meta('meta[property="og:title"]', 'property', 'og:title', title);
    meta('meta[property="og:description"]', 'property', 'og:description', summary);
    meta('meta[property="og:site_name"]', 'property', 'og:site_name', siteName);
    meta('meta[property="og:type"]', 'property', 'og:type', 'website');
    if (siteProfile.seoLocales) {
      meta('meta[property="og:locale"]', 'property', 'og:locale', siteProfile.seoLocales[language]);
      meta('meta[property="og:locale:alternate"]', 'property', 'og:locale:alternate',
        siteProfile.seoLocales[language === 'fr' ? 'en' : 'fr']);
    }
    if (siteProfile.seoOrigin) {
      const image = new URL(siteProfile.shareImageUrl, siteProfile.seoOrigin).href;
      const organization = document.querySelector<HTMLScriptElement>('#site-organization') ?? document.createElement('script');
      organization.id = 'site-organization';
      organization.type = 'application/ld+json';
      organization.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Organization', name: siteName,
        url: siteProfile.seoOrigin, image,
        ...(serviceArea ? { areaServed: serviceArea } : {}),
      }).replaceAll('<', '\\u003c');
      if (!organization.parentNode) document.head.append(organization);
      meta('meta[property="og:image"]', 'property', 'og:image', image);
      meta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
      meta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
      meta('meta[name="twitter:description"]', 'name', 'twitter:description', summary);
      meta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
      if (pageKey) {
        const path = marketingPath === '/' ? '' : `${marketingPath.slice(1)}/`;
        const url = `${siteProfile.seoOrigin}/${language}/${path}`;
        const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = url;
        if (!canonical.parentNode) document.head.append(canonical);
        for (const alternate of ['fr', 'en', 'x-default'] as const) {
          const link = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${alternate}"]`) ?? document.createElement('link');
          link.rel = 'alternate'; link.hreflang = alternate;
          link.href = `${siteProfile.seoOrigin}/${alternate === 'x-default'
            ? settings.data?.defaultLanguage ?? __CADRORA_SITE_DEFAULT_LANG__ : alternate}/${path}`;
          if (!link.parentNode) document.head.append(link);
        }
        meta('meta[property="og:url"]', 'property', 'og:url', url);
      } else {
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove();
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => link.remove());
        document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.remove();
      }
    }
  }, [description, language, marketingPath, pageDescription, pageKey, pageTitle, serviceArea, settings.data?.defaultLanguage, settings.data?.siteCopy, siteName, seoCopy, t]);

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta');
    if (!robots.parentNode) {
      robots.name = 'robots';
      document.head.append(robots);
    }
    robots.content = marketingPath === '/galleries' || marketingPath.startsWith('/e/')
      || (marketingPath === '/about' && settings.data?.aboutEnabled === false) ? 'noindex,nofollow' : 'index,follow';
  }, [marketingPath, settings.data?.aboutEnabled]);

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
    <div className={`public-shell${immersiveHome ? ' public-shell--immersive' : ''}${immersiveHome && immersiveFooterVisible ? ' public-shell--footer-visible' : ''}${marketingPath === '/contact' ? ' public-shell--contact' : ''}${menuOpen ? ' public-shell--menu-open' : ''}`}>
      <div className="public-masthead">
        {settings.data?.constructionNoticeEnabled ? <PublicConstructionNotice /> : null}
        <header className="public-header">
        <Link aria-label={t('gallery.home')} className="public-brand" onClick={() => setMenuOpen(false)} to={`/${language}`}>
          {siteProfile.logoUrl ? <BrandPhoto alt="" className="public-brand__logo" fit="contain" height={256} immediate sizes="40px" src={siteProfile.logoUrl} width={256} /> : null}
          <span className="public-brand__name">{siteName}</span>
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
            onClick={() => {
              rememberVisitorLanguage(nextLanguage);
              void i18n.changeLanguage(nextLanguage);
              if (pageKey) void navigate(`${localizedTarget(marketingPath, nextLanguage)}${search}${hash}`);
            }}
            title={t('gallery.changeLanguage', { language: nextLanguage.toUpperCase() })}
          >
            {nextLanguage.toUpperCase()}
          </IconButton> : null}
          </div>
        </div>
        </header>
      </div>
      <main className={`public-main${wide ? ' public-main--gallery' : ''}${fullBleed || immersiveHome ? ' public-main--immersive' : ''}`}>{children}</main>
      <footer className="public-footer" inert={immersiveHome && !immersiveFooterVisible}>
        <div className="public-footer__identity">
          <div className="public-footer__signature">
            <p>© {siteName}{footerTagline ? ` · ${footerTagline}` : ''}</p>
            {!siteProfile.demo.enabled ? (
              <a className="public-footer__credit" href="https://cadrora.com/">
                <span>{t('gallery.footerCredit')} </span>
                <BrandPhoto alt="" className="public-footer__logo" fit="contain" sizes="20px" src="/brand/cadrora-credit.webp" />
                <span>Cadrora</span>
              </a>
            ) : null}
          </div>
          {siteProfile.demo.enabled ? <p className="public-footer__note">{t('gallery.footerDemo')}</p> : null}
        </div>
        <nav aria-label={t('gallery.footerNavigation')}>
          <Link to={`/${language}/privacy`}>{t('gallery.privacy')}</Link>
          <button className="public-footer__button" onClick={openPrivacyPreferences} type="button">
            {t('gallery.consent.manage')}
          </button>
          {siteProfile.demo.enabled ? <Link to="/admin/login?demo=1">{t('gallery.adminDemo')}</Link> : null}
          <Link to={`/${language}/contact`}>{t('gallery.contact')}</Link>
        </nav>
      </footer>
      <GoogleAnalytics measurementId={settings.data?.analyticsMeasurementId ?? null} />
      <PrivacyConsent analyticsAvailable={Boolean(settings.data?.analyticsMeasurementId)} />
    </div>
  );
}
