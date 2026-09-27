import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MotionReveal, Spinner } from '../components';
import { getPublicEvents, getPublicServices, getPublicSiteSettings } from './api';
import { DemoExperienceCards } from './DemoExperienceCards';
import { FeaturedSites } from './FeaturedSites';
import { PublicEventCards } from './PublicEventCards';
import { PublicLayout } from './PublicLayout';
import { fallbackServices, serviceText } from './serviceCatalog';
import { ServicePhoto } from './ServicePhoto';
import { siteProfile } from './siteProfile';
import type { HomeSection, SiteAction } from '../site/types';

export function HomePage() {
  const Override = siteProfile.pages?.home;
  return Override ? <Override /> : <DefaultHomePage />;
}

function SiteActionLink({ action, variant, label, href }: { action?: SiteAction; variant: 'primary' | 'secondary'; label: string; href: string }) {
  const { t } = useTranslation();
  const content = <><span className="site-actions__full">{label}</span><span aria-hidden="true" className="site-actions__short">{action ? t(action.shortLabelKey) : label}</span></>;
  const className = `button button--${variant}`;
  const destination = href;
  return destination.startsWith('#')
    ? <a aria-label={label} className={className} href={destination}>{content}</a>
    : <Link aria-label={label} className={className} to={destination}>{content}</Link>;
}

export function DefaultHomePage() {
  const { t, i18n } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const showHomeGalleries = settings.data?.homeGalleries.enabled ?? true;
  const events = useQuery({ queryKey: ['public-events'], queryFn: getPublicEvents, enabled: !settings.isPending && showHomeGalleries });
  const featuredServices = (services.data ?? fallbackServices(settings.data?.enabledServices))
    .filter((card) => card.enabled && card.showOnHome).slice(0, settings.data?.homeServicesLimit ?? 3);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const hero = settings.data?.homeHeroCopy;
  const heroText = hero?.[language];
  const resolveAction = (href: string) => !showHomeGalleries && href === '#galleries' ? '/galleries' : href;
  const heroActions: { action?: SiteAction; href: string; label: string; variant: 'primary' | 'secondary' }[] = hero
    ? hero.buttons.map((button) => ({ href: resolveAction(button.href), label: button.labels[language], variant: button.variant }))
    : [
      { action: siteProfile.home.primaryAction, href: resolveAction(siteProfile.home.primaryAction.href),
        label: t(siteProfile.home.primaryAction.labelKey), variant: 'primary' },
      { action: siteProfile.home.secondaryAction, href: resolveAction(siteProfile.home.secondaryAction.href),
        label: t(siteProfile.home.secondaryAction.labelKey), variant: 'secondary' },
    ];
  return (
    <PublicLayout>
      <section className="site-hero">
        <MotionReveal className="site-hero__copy">
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
        </MotionReveal>
        <figure className="site-hero__art">
          <img alt={heroText?.imageAlt ?? t('gallery.heroImageAlt')} fetchPriority="high" height="853" loading="eager"
            sizes="(max-width: 48rem) 100vw, 42vw" src="/home-hero-image/medium"
            srcSet="/home-hero-image/small 640w, /home-hero-image/medium 960w, /home-hero-image/large 1280w" width="1280" />
          {(heroText?.caption ?? t('gallery.heroArtCaption')) ? <figcaption>{heroText?.caption ?? t('gallery.heroArtCaption')}</figcaption> : null}
          {siteProfile.heroAccentImageUrl ? <div className="site-hero__ai-card">
            <img alt="" src={siteProfile.heroAccentImageUrl} />
            <div><span>{t('gallery.heroAiLabel')}</span><strong>{t('gallery.heroAiValue')}</strong></div>
          </div> : null}
        </figure>
      </section>

      {siteProfile.home.sections.map((section: HomeSection) => <Fragment key={section}>{section === 'demo' && siteProfile.demo.enabled ? <MotionReveal as="section" labelledBy="demo-title" className="site-section site-section--demo">
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
        <div className="service-grid">
          {featuredServices.map((card, index) => {
            const copy = serviceText(card, language, (key) => t(key));
            return <MotionReveal as="article" className="service-card" delay={(index % 3) as 0 | 1 | 2} key={card.id}>
              <ServicePhoto card={card} className="service-card__image" sizes="(max-width: 48rem) 100vw, 33vw" />
              <div className="service-card__copy"><h3>{copy.title}</h3><p>{copy.shortDescription}</p></div>
            </MotionReveal>;
          })}
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
        <PublicEventCards events={events.data} language={i18n.language} limit={settings.data?.homeGalleries.limit ?? 6} />
      </MotionReveal> : null}

      {section === 'featuredSites' && siteProfile.home.featuredSites?.length ? <FeaturedSites sites={siteProfile.home.featuredSites} /> : null}

      {section === 'contact' ? <MotionReveal as="section" className="site-contact-callout">
        <div>
          <p className="site-eyebrow">{t('gallery.contactEyebrow')}</p>
          <h2>{t('gallery.contactCalloutTitle')}</h2>
        </div>
        <Link className="button button--primary" to="/contact">{t('gallery.contactCalloutAction')}</Link>
      </MotionReveal> : null}</Fragment>)}
    </PublicLayout>
  );
}
