import { useQuery } from '@tanstack/react-query';
import { Fragment, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Button, MotionReveal, ProgressivePhoto, Spinner } from '../components';
import { getPublicEvents, getPublicSiteSettings } from './api';
import { DemoExperienceCards } from './DemoExperienceCards';
import { FeaturedSites } from './FeaturedSites';
import { PublicEventCards } from './PublicEventCards';
import { PublicLayout } from './PublicLayout';
import { serviceText } from './serviceCatalog';
import { ServicePhotoHeader } from './ServicePhotoHeader';
import { SessionScrollStory } from './SessionScrollStory';
import { SessionDetailsModal } from './SessionDetailsModal';
import { SiteStartup } from './SiteStartup';
import { siteProfile } from './siteProfile';
import { usePublicServiceCatalog } from './usePublicServiceCatalog';
import { BrandPhoto } from './BrandPhoto';
import { localizedMarketingPath } from './localizedMarketingPath';
import type { HomeSection, SiteAction } from '../site/types';
import { MarketingRenderContext } from '../prerender/context';

export function HomePage() {
  const Override = siteProfile.pages?.home;
  return Override ? <Override /> : siteProfile.home.presentation === 'session-slides'
    ? <SessionScrollStory /> : <DefaultHomePage />;
}

function SiteActionLink({ action, variant, label, href }: { action?: SiteAction; variant: 'primary' | 'secondary'; label: string; href: string }) {
  const { i18n, t } = useTranslation();
  const content = <><span className="site-actions__full">{label}</span><span aria-hidden="true" className="site-actions__short">{action ? t(action.shortLabelKey) : label}</span></>;
  const className = `button button--${variant}`;
  const destination = localizedMarketingPath(href, i18n.resolvedLanguage ?? i18n.language);
  return destination.startsWith('#')
    ? <a aria-label={label} className={className} href={destination}>{content}</a>
    : <Link aria-label={label} className={className} to={destination}>{content}</Link>;
}

export function DefaultHomePage() {
  const { t, i18n } = useTranslation();
  const marketingRender = useContext(MarketingRenderContext);
  const { hash } = useLocation();
  const heroArt = useRef<HTMLElement>(null);
  const [heroPhotoReady, setHeroPhotoReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markHeroPhotoReady = useCallback(() => setHeroPhotoReady(true), []);
  useLayoutEffect(() => {
    if (!marketingRender || !heroPhotoReady || !hash) return;
    // Native fragment navigation happens while the startup frame clips the page.
    // Honor a direct link once the same, fully styled DOM becomes available.
    try { document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'instant' }); }
    catch { /* A malformed fragment must not block the page. */ }
  }, [hash, heroPhotoReady, marketingRender]);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  useLayoutEffect(() => {
    // On narrow screens the photo can be entirely below the first viewport.
    // It must not hold an otherwise complete first screen behind the identity.
    if (marketingRender && heroArt.current && heroArt.current.getBoundingClientRect().top >= window.innerHeight) {
      markHeroPhotoReady();
    }
  }, [marketingRender, settings.isPending, markHeroPhotoReady]);
  const services = usePublicServiceCatalog(settings);
  const galleryDirectoryEnabled = settings.data?.galleryDirectoryEnabled === true;
  const showHomeGalleries = galleryDirectoryEnabled && (settings.data?.homeGalleries.enabled ?? true);
  const events = useQuery({ queryKey: ['public-events'], queryFn: getPublicEvents, enabled: !settings.isPending && showHomeGalleries });
  const featuredServices = services.cards.filter((card) => card.showOnHome);
  const selectedCard = featuredServices.find((card) => card.id === selectedId);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const hero = settings.data?.homeHeroCopy;
  const heroText = hero?.[language];
  const heroImagePath = settings.data?.homeHeroImageRevision
    ? `/service-media/home-hero/${settings.data.homeHeroImageRevision}` : '/home-hero-image';
  const galleryActionHidden = (href: string) => !galleryDirectoryEnabled
    && (href === '#galleries' || href === '/galleries' || href.startsWith('/e/'));
  const resolveAction = (href: string) => galleryActionHidden(href)
    ? '/portfolio' : settings.data?.sessionsPageEnabled !== true && href === '/services'
      ? '#services' : !showHomeGalleries && href === '#galleries' ? '/galleries' : href;
  const portfolioLabel = t('gallery.portfolioPage.homeAction');
  const heroActions: { action?: SiteAction; href: string; label: string; variant: 'primary' | 'secondary' }[] = (hero
    ? hero.buttons.map((button) => ({ href: resolveAction(button.href),
      label: galleryActionHidden(button.href) ? portfolioLabel : button.labels[language], variant: button.variant }))
    : [siteProfile.home.primaryAction, siteProfile.home.secondaryAction].map((action, index) => ({
      action: galleryActionHidden(action.href) ? undefined : action,
      href: resolveAction(action.href),
      label: galleryActionHidden(action.href) ? portfolioLabel : t(action.labelKey),
      variant: index === 0 ? 'primary' as const : 'secondary' as const,
    }))).filter((action, index, actions) => action.href !== '/portfolio'
      || actions.findIndex((candidate) => candidate.href === '/portfolio') === index);
  // Resolve optional section visibility before exposing the layout. Inserting the
  // demo above an already painted stack section caused a reproducible layout shift.
  if (settings.isPending) return <div className="session-home"><SiteStartup /></div>;
  return (
    <div className={`session-home${heroPhotoReady ? '' : ' session-home--pending'}`}>
      {!heroPhotoReady ? <SiteStartup siteName={settings.data?.siteName} /> : null}
      <div aria-hidden={!heroPhotoReady || undefined} className={`session-home__stage${heroPhotoReady ? '' : ' session-home__stage--pending'}`} inert={!heroPhotoReady}>
        <PublicLayout>
          <section className="site-hero">
            <div className="site-hero__copy">
              <p className="site-eyebrow">{heroText?.label ?? t('gallery.heroEyebrow')}</p>
              <h1>{heroText?.title ?? t('gallery.heroTitle')}</h1>
              <p className="site-hero__lead">{heroText?.description ?? t('gallery.heroLead')}</p>
              {heroActions.length ? <div className="site-actions">
                {heroActions.map((action, index) => <SiteActionLink {...action} key={index} />)}
              </div> : null}
              {siteProfile.home.showProof ? <div className="site-hero__proof" aria-label={t('gallery.productProofLabel')}>
                <span>{t('gallery.productProof.private')}</span>
                <span>{t('gallery.productProof.free')}</span>
                <span>{t('gallery.productProof.open')}</span>
              </div> : null}
            </div>
            <figure className="site-hero__art" ref={heroArt}>
              <ProgressivePhoto alt={heroText?.imageAlt ?? t('gallery.heroImageAlt')} enabled={!settings.isPending}
                height={853} immediate onVisualReady={markHeroPhotoReady} visualReadyAt="display" priority sizes="(max-width: 48rem) 100vw, 42vw" width={1280}
                sources={[
                  { url: `${heroImagePath}/preview`, width: 320 },
                  { url: `${heroImagePath}/small`, width: 640 },
                  { url: `${heroImagePath}/medium`, width: settings.data?.homeHeroImageMediumWidth ?? 960 },
                  { url: `${heroImagePath}/large`, width: settings.data?.homeHeroImageLargeWidth ?? 1280 },
                ]} />
              {(heroText?.caption ?? t('gallery.heroArtCaption')) ? <figcaption>{heroText?.caption ?? t('gallery.heroArtCaption')}</figcaption> : null}
              {siteProfile.heroAccentImageUrl ? <div className="site-hero__ai-card">
                <BrandPhoto alt="" className="site-hero__accent-photo" immediate sizes="56px" src={siteProfile.heroAccentImageUrl} />
                <div><span>{t('gallery.heroAiLabel')}</span><strong>{t('gallery.heroAiValue')}</strong></div>
              </div> : null}
            </figure>
          </section>

          {siteProfile.home.sections.map((section: HomeSection) => <Fragment key={section}>{section === 'demo' && siteProfile.demo.enabled && galleryDirectoryEnabled ? <MotionReveal as="section" labelledBy="demo-title" className="site-section site-section--demo">
            <div className="site-section__heading site-section__heading--row">
              <div>
                <p className="site-eyebrow">{t('gallery.demo.eyebrow')}</p>
                <h2 id="demo-title">{t('gallery.demo.sectionTitle')}</h2>
              </div>
              <p>{t('gallery.demo.sectionLead')}</p>
            </div>
            <DemoExperienceCards />
          </MotionReveal> : null}

          {section === 'stack' ? <MotionReveal as="section" labelledBy="stack-title" className="product-stack">
            <div>
              <p className="site-eyebrow">{t('gallery.stack.eyebrow')}</p>
              <h2 id="stack-title">{t('gallery.stack.title')}</h2>
            </div>
            <p>{t('gallery.stack.body')}</p>
            <a className="button button--secondary" href="https://github.com/lbouriez/Cadrora" rel="noreferrer" target="_blank">{t('gallery.stack.github')} <span aria-hidden="true">↗</span></a>
          </MotionReveal> : null}

          {section === 'services' ? <MotionReveal as="section" labelledBy="services-title" className="site-section" id="services">
            <div className="site-section__heading">
              <p className="site-eyebrow">{t('gallery.servicesEyebrow')}</p>
              <h2 id="services-title">{t('gallery.servicesTitle')}</h2>
              <p>{t('gallery.servicesLead')}</p>
            </div>
            <div aria-busy={services.isPending} className="service-grid">
              {services.isPending ? <Spinner label={t('gallery.servicesLoading')} /> : null}
              {featuredServices.map((card, index) => {
                const copy = serviceText(card, language, (key) => t(key));
                return <MotionReveal as="article" className="service-card" delay={(index % 3) as 0 | 1 | 2} key={card.id}>
                  <ServicePhotoHeader card={card} className="service-card__visual" heading="h3"
                    sizes="(max-width: 48rem) 100vw, 33vw" title={copy.title} />
                  <div className="service-card__copy"><p>{copy.shortDescription}</p>
                    <Button aria-haspopup="dialog" onClick={() => setSelectedId(card.id)} variant="secondary">{t('gallery.servicesPage.moreInfo')}</Button>
                  </div>
                </MotionReveal>;
              })}
            </div>
            <div className="site-actions">
              {settings.data?.sessionsPageEnabled === true
                ? <Link className="button button--secondary" to={localizedMarketingPath('/services', language)}>{t('gallery.servicesPage.viewAll')}</Link> : null}
              <Link className="button button--secondary" to={localizedMarketingPath('/portfolio', language)}>{t('gallery.portfolioPage.homeAction')}</Link>
            </div>
          </MotionReveal> : null}

          {section === 'approach' ? <MotionReveal as="section" labelledBy="approach-title" className="site-statement">
            <p className="site-eyebrow">{t('gallery.approachEyebrow')}</p>
            <h2 id="approach-title">{t('gallery.approachTitle')}</h2>
            <p>{t('gallery.approachBody')}</p>
          </MotionReveal> : null}

          {section === 'galleries' && showHomeGalleries ? <MotionReveal as="section" labelledBy="galleries-title" className="site-section" id="galleries">
            <div className="site-section__heading site-section__heading--row">
              <div>
                <p className="site-eyebrow">{t('gallery.galleryEyebrow')}</p>
                <h2 id="galleries-title">{t('gallery.events')}</h2>
              </div>
              <p>{t('gallery.galleryLead')}</p>
            </div>
            {events.isPending ? <Spinner label={t('gallery.loading')} /> : null}
            {events.isError ? <p className="gallery-notice" role="status">{t('gallery.eventsUnavailable')}</p> : null}
            {events.data?.length === 0 ? <p className="gallery-notice">{t('gallery.noEvents')}</p> : null}
            <PublicEventCards events={events.data} language={i18n.language} limit={settings.data?.homeGalleries.limit ?? 6} prioritizeFirstRow={false} />
          </MotionReveal> : null}

          {section === 'featuredSites' && siteProfile.home.featuredSites?.length ? <FeaturedSites sites={siteProfile.home.featuredSites} /> : null}

          {section === 'contact' ? <MotionReveal as="section" className="site-contact-callout">
            <div>
              <p className="site-eyebrow">{t('gallery.contactEyebrow')}</p>
              <h2>{t('gallery.contactCalloutTitle')}</h2>
            </div>
            <Link className="button button--primary" to={localizedMarketingPath('/contact', language)}>{t('gallery.contactCalloutAction')}</Link>
          </MotionReveal> : null}</Fragment>)}
          <SessionDetailsModal card={selectedCard ?? null} onClose={() => setSelectedId(null)} />
        </PublicLayout>
      </div>
    </div>
  );
}
