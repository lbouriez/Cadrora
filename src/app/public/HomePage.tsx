import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Spinner } from '../components';
import { getPublicEvents } from './api';
import { DemoExperienceCards } from './DemoExperienceCards';
import { PublicLayout } from './PublicLayout';
import { siteProfile } from './siteProfile';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const events = useQuery({ queryKey: ['public-events'], queryFn: getPublicEvents });
  return (
    <PublicLayout>
      <section className="site-hero">
        <div className="site-hero__copy">
          <p className="site-eyebrow">{t('gallery.heroEyebrow')}</p>
          <h1>{t('gallery.heroTitle')}</h1>
          <p className="site-hero__lead">{t('gallery.heroLead', {
            photographer: siteProfile.photographerName ?? siteProfile.siteName,
          })}</p>
          <div className="site-actions">
            <a className="button button--primary" href="#galleries">{t('gallery.discoverGalleries')}</a>
            <Link className="button button--secondary" to="/contact">{t('gallery.talkAboutProject')}</Link>
          </div>
        </div>
        <figure className="site-hero__art">
          <img
            alt={t('gallery.heroImageAlt')}
            height="1024"
            src="/brand/demo-hero.webp"
            width="1536"
          />
          <figcaption>{t('gallery.heroArtCaption')}</figcaption>
        </figure>
      </section>

      {siteProfile.demo.enabled ? <section aria-labelledby="demo-title" className="site-section site-section--demo">
        <div className="site-section__heading site-section__heading--row">
          <div>
            <p className="site-eyebrow">{t('gallery.demo.eyebrow')}</p>
            <h2 id="demo-title">{t('gallery.demo.sectionTitle')}</h2>
          </div>
          <p>{t('gallery.demo.sectionLead')}</p>
        </div>
        <DemoExperienceCards />
      </section> : null}

      <section aria-labelledby="services-title" className="site-section" id="services">
        <div className="site-section__heading">
          <p className="site-eyebrow">{t('gallery.servicesEyebrow')}</p>
          <h2 id="services-title">{t('gallery.servicesTitle')}</h2>
          <p>{t('gallery.servicesLead')}</p>
        </div>
        <div className="service-grid">
          {(['events', 'portraits', 'stories'] as const).map((service, index) => (
            <article className="service-card" key={service}>
              <span aria-hidden="true">0{index + 1}</span>
              <h3>{t(`gallery.service.${service}.title`)}</h3>
              <p>{t(`gallery.service.${service}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="approach-title" className="site-statement">
        <p className="site-eyebrow">{t('gallery.approachEyebrow')}</p>
        <h2 id="approach-title">{t('gallery.approachTitle')}</h2>
        <p>{t('gallery.approachBody')}</p>
      </section>

      <section aria-labelledby="galleries-title" className="site-section" id="galleries">
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

      <section className="site-contact-callout">
        <div>
          <p className="site-eyebrow">{t('gallery.contactEyebrow')}</p>
          <h2>{t('gallery.contactCalloutTitle')}</h2>
        </div>
        <Link className="button button--primary" to="/contact">{t('gallery.contactCalloutAction')}</Link>
      </section>
    </PublicLayout>
  );
}
