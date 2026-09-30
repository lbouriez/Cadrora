import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';

import { Button, InfiniteLoadMore, Modal, MotionReveal, Spinner } from '../components';
import { getPublicGalleryIndex, getPublicServices, getPublicSiteSettings } from './api';
import { PublicEventCards } from './PublicEventCards';
import { PublicLayout } from './PublicLayout';
import { PublicPageIntro } from './PublicPageIntro';
import { fallbackServices, serviceText } from './serviceCatalog';
import { ServicePhotoHeader } from './ServicePhotoHeader';
import { siteProfile } from './siteProfile';

export function ServicesPage() {
  const Override = siteProfile.pages?.services;
  return Override ? <Override /> : <DefaultServicesPage />;
}

export function DefaultServicesPage() {
  const { i18n, t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const visibleServices = (services.data ?? fallbackServices(settings.data?.enabledServices)).filter((card) => card.enabled);
  const selectedCard = visibleServices.find((card) => card.id === selectedId);
  const selectedCopy = selectedCard ? serviceText(selectedCard, language, (key) => t(key)) : null;
  return (
    <PublicLayout>
      <PublicPageIntro eyebrow={t('gallery.servicesPage.eyebrow')}
        lead={t('gallery.servicesPage.lead')} title={t('gallery.servicesPage.title')} />
      <div className="service-detail-grid">
        {visibleServices.map((card, index) => {
          const copy = serviceText(card, language, (key) => t(key));
          return <MotionReveal as="article" className="service-detail-card" delay={(index % 3) as 0 | 1 | 2} key={card.id}>
            <ServicePhotoHeader card={card} className="service-detail-card__visual" heading="h2"
              immediate={index === 0} priority={index === 0} sizes="(max-width: 48rem) 100vw, 50vw" title={copy.title} />
            <div className="service-detail-card__copy">
              <p>{copy.description}</p>
              <ul>
                {copy.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
              </ul>
              <Button onClick={() => setSelectedId(card.id)} variant="secondary">{t('gallery.servicesPage.moreInfo')}</Button>
            </div>
          </MotionReveal>;
        })}
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
      <Modal className="service-details-modal" closeLabel={t('gallery.servicesPage.closeDetails')}
        onClose={() => setSelectedId(null)} open={Boolean(selectedCopy)} title={selectedCopy?.title ?? ''}>
        {selectedCopy ? <div className="service-details-modal__body">
          <p>{selectedCopy.description}</p>
          {selectedCopy.duration ? <p><strong>{t('gallery.servicesPage.durationLabel')}</strong> {selectedCopy.duration}</p> : null}
          {selectedCopy.priceRange ? <p><strong>{t('gallery.servicesPage.priceLabel')}</strong> {selectedCopy.priceRange}</p> : null}
          {selectedCopy.illustrativeExample ? <p className="service-details-modal__example-note">{t('gallery.servicesPage.exampleNotice')}</p> : null}
          {selectedCopy.details ? <p className="service-details-modal__details">{selectedCopy.details}</p> : null}
          {selectedCopy.points.length ? <><h3>{t('gallery.servicesPage.includedLabel')}</h3>
            <ul>{selectedCopy.points.map((point, index) => <li key={index}>{point}</li>)}</ul></> : null}
          <Link className="button button--primary" onClick={() => setSelectedId(null)} to="/contact">{t('gallery.contactCalloutAction')}</Link>
        </div> : null}
      </Modal>
    </PublicLayout>
  );
}

export function GalleriesPage() {
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  if (settings.data?.galleryDirectoryEnabled === false) return <Navigate replace to="/portfolio" />;
  const Override = siteProfile.pages?.galleries;
  return Override ? <Override /> : <DefaultGalleriesPage />;
}

export function DefaultGalleriesPage() {
  const { i18n, t } = useTranslation();
  const events = useInfiniteQuery({
    queryKey: ['public-gallery-index'],
    queryFn: ({ pageParam }) => getPublicGalleryIndex(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const publicGalleries = events.data?.pages.flatMap((page) => page.events) ?? [];
  const protectedGalleries = events.data?.pages.flatMap((page) => page.protectedGalleries) ?? [];
  return (
    <PublicLayout>
      <PublicPageIntro eyebrow={t('gallery.eventsPage.eyebrow')}
        lead={t('gallery.eventsPage.lead')} title={t('gallery.eventsPage.title')} />
      <section aria-labelledby="published-events-title" className="site-section site-section--compact">
        <div className="site-section__heading">
          <p className="site-eyebrow">{t('gallery.galleryListEyebrow')}</p>
          <h2 id="published-events-title">{t('gallery.eventsPage.publishedTitle')}</h2>
        </div>
        {events.isPending ? <Spinner label={t('gallery.loading')} /> : null}
        {events.isError && !events.data ? <p className="gallery-notice" role="status">{t('gallery.eventsUnavailable')}</p> : null}
        {events.data && publicGalleries.length === 0 && protectedGalleries.length === 0 ? <p className="gallery-notice">{t('gallery.noEvents')}</p> : null}
        <PublicEventCards events={publicGalleries} language={i18n.language} protectedGalleries={protectedGalleries} />
        <InfiniteLoadMore error={events.isFetchNextPageError} errorLabel={t('gallery.moreGalleriesUnavailable')}
          hasMore={Boolean(events.hasNextPage)} loadLabel={t('gallery.loadMoreGalleries')}
          loading={events.isFetchingNextPage} loadingLabel={t('gallery.loading')}
          onLoadMore={() => void events.fetchNextPage()} />
      </section>
    </PublicLayout>
  );
}
