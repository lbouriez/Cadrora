import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MotionReveal, Spinner } from '../components';
import { getPublicEvents, getPublicSiteSettings } from './api';
import { DemoExperienceCards } from './DemoExperienceCards';
import { PublicEventCards } from './PublicEventCards';
import { PublicLayout } from './PublicLayout';
import { serviceVisuals } from './serviceCatalog';
import { siteProfile } from './siteProfile';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const events = useQuery({ queryKey: ['public-events'], queryFn: getPublicEvents });
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const featuredServices = serviceVisuals.filter(({ key }) => settings.data?.enabledServices.includes(key) ?? true).slice(0, 3);
  return (
    <PublicLayout>
      <section className="site-hero">
        <MotionReveal className="site-hero__copy">
          <p className="site-eyebrow">{t('gallery.heroEyebrow')}</p>
          <h1>{t('gallery.heroTitle')}</h1>
          <p className="site-hero__lead">{t('gallery.heroLead')}</p>
          <div className="site-actions">
            <Link aria-label={t('gallery.tryAi')} className="button button--primary" to="/e/find-your-photos/find"><span className="site-actions__full">{t('gallery.tryAi')}</span><span aria-hidden="true" className="site-actions__short">{t('gallery.tryAiShort')}</span></Link>
            <a aria-label={t('gallery.discoverGalleries')} className="button button--secondary" href="#galleries"><span className="site-actions__full">{t('gallery.discoverGalleries')}</span><span aria-hidden="true" className="site-actions__short">{t('gallery.discoverGalleriesShort')}</span></a>
          </div>
          <div className="site-hero__proof" aria-label={t('gallery.productProofLabel')}>
            <span>{t('gallery.productProof.private')}</span>
            <span>{t('gallery.productProof.free')}</span>
            <span>{t('gallery.productProof.open')}</span>
          </div>
        </MotionReveal>
        <MotionReveal as="figure" className="site-hero__art" delay={1} effect="scale">
          <img
            alt={t('gallery.heroImageAlt')}
            height="1024"
            src="/brand/demo-hero.webp"
            width="1536"
          />
          <figcaption>{t('gallery.heroArtCaption')}</figcaption>
          <div className="site-hero__ai-card">
            <img alt="" src="/demo/face-search/test-portrait-amelia.webp" />
            <div><span>{t('gallery.heroAiLabel')}</span><strong>{t('gallery.heroAiValue')}</strong></div>
          </div>
        </MotionReveal>
      </section>

      {siteProfile.demo.enabled ? <MotionReveal as="section" labelledBy="demo-title" className="site-section site-section--demo">
        <div className="site-section__heading site-section__heading--row">
          <div>
            <p className="site-eyebrow">{t('gallery.demo.eyebrow')}</p>
            <h2 id="demo-title">{t('gallery.demo.sectionTitle')}</h2>
          </div>
          <p>{t('gallery.demo.sectionLead')}</p>
        </div>
        <DemoExperienceCards />
      </MotionReveal> : null}

      <MotionReveal as="section" labelledBy="stack-title" className="product-stack">
        <div>
          <p className="site-eyebrow">{t('gallery.stack.eyebrow')}</p>
          <h2 id="stack-title">{t('gallery.stack.title')}</h2>
        </div>
        <p>{t('gallery.stack.body')}</p>
        <a className="button button--secondary" href="https://github.com/lbouriez/Cadrora" rel="noreferrer" target="_blank">{t('gallery.stack.github')} <span aria-hidden="true">↗</span></a>
      </MotionReveal>

      <MotionReveal as="section" labelledBy="services-title" className="site-section" id="services">
        <div className="site-section__heading">
          <p className="site-eyebrow">{t('gallery.servicesEyebrow')}</p>
          <h2 id="services-title">{t('gallery.servicesTitle')}</h2>
          <p>{t('gallery.servicesLead')}</p>
        </div>
        <div className="service-grid">
          {featuredServices.map(({ key, src }, index) => (
            <MotionReveal as="article" className="service-card" delay={(index % 3) as 0 | 1 | 2} key={key}>
              <img alt="" className="service-card__image" loading="lazy" src={src} />
              <div className="service-card__copy"><h3>{t(`gallery.servicesPage.${key}.title`)}</h3><p>{t(`gallery.servicesPage.${key}.body`)}</p></div>
            </MotionReveal>
          ))}
        </div>
      </MotionReveal>

      <MotionReveal as="section" labelledBy="approach-title" className="site-statement">
        <p className="site-eyebrow">{t('gallery.approachEyebrow')}</p>
        <h2 id="approach-title">{t('gallery.approachTitle')}</h2>
        <p>{t('gallery.approachBody')}</p>
      </MotionReveal>

      <MotionReveal as="section" labelledBy="galleries-title" className="site-section" id="galleries">
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
        <PublicEventCards events={events.data} language={i18n.language} />
      </MotionReveal>

      <MotionReveal as="section" className="site-contact-callout">
        <div>
          <p className="site-eyebrow">{t('gallery.contactEyebrow')}</p>
          <h2>{t('gallery.contactCalloutTitle')}</h2>
        </div>
        <Link className="button button--primary" to="/contact">{t('gallery.contactCalloutAction')}</Link>
      </MotionReveal>
    </PublicLayout>
  );
}
