import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MotionReveal, Spinner } from '../components';
import { getPublicGalleryIndex, getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicEventCards } from './PublicEventCards';
import { PublicLayout } from './PublicLayout';
import { serviceVisuals } from './serviceCatalog';
import { siteProfile } from './siteProfile';

export function ServicesPage() {
  const Override = siteProfile.pages?.services;
  return Override ? <Override /> : <DefaultServicesPage />;
}

export function DefaultServicesPage() {
  const { t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const visibleServices = serviceVisuals.filter(({ key }) => settings.data?.enabledServices.includes(key) ?? true);
  return (
    <PublicLayout>
      <MotionReveal as="header" className="editorial-heading editorial-heading--services">
        <p className="site-eyebrow">{t('gallery.servicesPage.eyebrow')}</p>
        <h1>{t('gallery.servicesPage.title')}</h1>
        <p>{t('gallery.servicesPage.lead')}</p>
      </MotionReveal>
      <div className="service-detail-grid">
        {visibleServices.map(({ key, src }, index) => (
          <MotionReveal as="article" className="service-detail-card" delay={(index % 3) as 0 | 1 | 2} key={key}>
            <BrandPhoto alt="" className="service-detail-card__image" immediate={index === 0} priority={index === 0} sizes="(max-width: 48rem) 100vw, 50vw" src={src} />
            <div className="service-detail-card__copy">
              <h2>{t(`gallery.servicesPage.${key}.title`)}</h2>
              <p>{t(`gallery.servicesPage.${key}.body`)}</p>
              <ul>
                <li>{t(`gallery.servicesPage.${key}.point1`)}</li>
                <li>{t(`gallery.servicesPage.${key}.point2`)}</li>
                <li>{t(`gallery.servicesPage.${key}.point3`)}</li>
              </ul>
            </div>
          </MotionReveal>
        ))}
      </div>
      <MotionReveal as="section" className="process-section">
        <div>
          <p className="site-eyebrow">{t('gallery.servicesPage.processEyebrow')}</p>
          <h2>{t('gallery.servicesPage.processTitle')}</h2>
        </div>
        <ol>
          <li><span aria-hidden="true">•</span><p>{t('gallery.servicesPage.process1')}</p></li>
          <li><span aria-hidden="true">•</span><p>{t('gallery.servicesPage.process2')}</p></li>
          <li><span aria-hidden="true">•</span><p>{t('gallery.servicesPage.process3')}</p></li>
        </ol>
      </MotionReveal>
      <MotionReveal as="section" className="site-contact-callout">
        <div><p className="site-eyebrow">{t('gallery.contactEyebrow')}</p><h2>{t('gallery.servicesPage.cta')}</h2></div>
        <Link className="button button--primary" to="/contact">{t('gallery.contactCalloutAction')}</Link>
      </MotionReveal>
    </PublicLayout>
  );
}

export function GalleriesPage() {
  const Override = siteProfile.pages?.galleries;
  return Override ? <Override /> : <DefaultGalleriesPage />;
}

export function DefaultGalleriesPage() {
  const { i18n, t } = useTranslation();
  const events = useQuery({ queryKey: ['public-gallery-index'], queryFn: getPublicGalleryIndex });
  return (
    <PublicLayout>
      <MotionReveal as="header" className="editorial-heading">
        <p className="site-eyebrow">{t('gallery.eventsPage.eyebrow')}</p>
        <h1>{t('gallery.eventsPage.title')}</h1>
        <p>{t('gallery.eventsPage.lead')}</p>
      </MotionReveal>
      <section aria-labelledby="published-events-title" className="site-section site-section--compact">
        <div className="site-section__heading">
          <p className="site-eyebrow">{t('gallery.galleryListEyebrow')}</p>
          <h2 id="published-events-title">{t('gallery.eventsPage.publishedTitle')}</h2>
        </div>
        {events.isPending ? <Spinner label={t('gallery.loading')} /> : null}
        {events.isError ? <p className="gallery-notice" role="status">{t('gallery.eventsUnavailable')}</p> : null}
        {events.data?.events.length === 0 && events.data.protectedGalleries.length === 0 ? <p className="gallery-notice">{t('gallery.noEvents')}</p> : null}
        <PublicEventCards events={events.data?.events} language={i18n.language} protectedGalleries={events.data?.protectedGalleries ?? []} />
      </section>
    </PublicLayout>
  );
}
