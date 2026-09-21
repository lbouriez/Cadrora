import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Spinner } from '../components';
import { getPublicEvents } from './api';
import { DemoExperienceCards } from './DemoExperienceCards';
import { PublicLayout } from './PublicLayout';
import { siteProfile } from './siteProfile';

export function ServicesPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <header className="editorial-heading">
        <p className="site-eyebrow">{t('gallery.servicesPage.eyebrow')}</p>
        <h1>{t('gallery.servicesPage.title')}</h1>
        <p>{t('gallery.servicesPage.lead')}</p>
      </header>
      <div className="service-detail-grid">
        {(['wedding', 'family', 'brand'] as const).map((service, index) => (
          <article className="service-detail-card" key={service}>
            <span>0{index + 1}</span>
            <div>
              <h2>{t(`gallery.servicesPage.${service}.title`)}</h2>
              <p>{t(`gallery.servicesPage.${service}.body`)}</p>
              <ul>
                <li>{t(`gallery.servicesPage.${service}.point1`)}</li>
                <li>{t(`gallery.servicesPage.${service}.point2`)}</li>
                <li>{t(`gallery.servicesPage.${service}.point3`)}</li>
              </ul>
            </div>
          </article>
        ))}
      </div>
      <section className="process-section">
        <div>
          <p className="site-eyebrow">{t('gallery.servicesPage.processEyebrow')}</p>
          <h2>{t('gallery.servicesPage.processTitle')}</h2>
        </div>
        <ol>
          <li><span>01</span><p>{t('gallery.servicesPage.process1')}</p></li>
          <li><span>02</span><p>{t('gallery.servicesPage.process2')}</p></li>
          <li><span>03</span><p>{t('gallery.servicesPage.process3')}</p></li>
        </ol>
      </section>
      <section className="site-contact-callout">
        <div><p className="site-eyebrow">{t('gallery.contactEyebrow')}</p><h2>{t('gallery.servicesPage.cta')}</h2></div>
        <Link className="button button--primary" to="/contact">{t('gallery.contactCalloutAction')}</Link>
      </section>
    </PublicLayout>
  );
}

export function EventsPage() {
  const { i18n, t } = useTranslation();
  const events = useQuery({ queryKey: ['public-events'], queryFn: getPublicEvents });
  return (
    <PublicLayout>
      <header className="editorial-heading">
        <p className="site-eyebrow">{t('gallery.eventsPage.eyebrow')}</p>
        <h1>{t('gallery.eventsPage.title')}</h1>
        <p>{t('gallery.eventsPage.lead')}</p>
      </header>
      {siteProfile.demo.enabled ? <section aria-labelledby="demo-experiences-title" className="site-section site-section--compact">
        <div className="site-section__heading">
          <h2 id="demo-experiences-title">{t('gallery.demo.sectionTitle')}</h2>
          <p>{t('gallery.demo.sectionLead')}</p>
        </div>
        <DemoExperienceCards />
      </section> : null}
      <section aria-labelledby="published-events-title" className="site-section site-section--compact">
        <div className="site-section__heading">
          <p className="site-eyebrow">{t('gallery.galleryEyebrow')}</p>
          <h2 id="published-events-title">{t('gallery.eventsPage.publishedTitle')}</h2>
        </div>
        {events.isPending ? <Spinner label={t('gallery.loading')} /> : null}
        {events.isError ? <p className="gallery-notice" role="status">{t('gallery.eventsUnavailable')}</p> : null}
        {events.data?.length === 0 ? <p className="gallery-notice">{t('gallery.noEvents')}</p> : null}
        <div className="event-list">
          {events.data?.map((event) => (
            <article className="event-card" key={event.id}>
              <p className="event-card__date">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(event.startsAt))}</p>
              <h3>{event.title}</h3>
              {event.description ? <p>{event.description}</p> : null}
              <Link className="event-card__link" to={`/e/${event.slug}`}>{t('gallery.openEvent')} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
