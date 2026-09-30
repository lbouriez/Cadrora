import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MotionReveal } from '../components';
import { getPublicServices, getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { ServicePhoto } from './ServicePhoto';
import { fallbackServices, serviceText } from './serviceCatalog';
import { siteProfile } from './siteProfile';
import { useSessionStorySteps } from './useSessionStorySteps';

/** Present the owner-managed Home sessions as one full-height panel per scroll gesture. */
export function SessionScrollStory() {
  const { i18n, t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const sessions = (services.data ?? fallbackServices(settings.data?.enabledServices))
    .filter((card) => card.enabled && card.showOnHome);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const storyRef = useSessionStorySteps(sessions.length);

  return <PublicLayout>
    <section aria-label={t('gallery.services')} className="session-story" ref={storyRef}>
      {sessions.length ? sessions.map((card, index) => {
        const copy = serviceText(card, language, (key) => t(key));
        const Heading = index === 0 ? 'h1' : 'h2';
        return <article className="session-story__panel" key={card.id}>
          <ServicePhoto card={card} className="session-story__photo" immediate={index === 0}
            priority={index === 0} sizes="100vw" />
          <div className="session-story__shade" />
          <MotionReveal className="session-story__content">
            <p className="session-story__eyebrow">{t('gallery.servicesEyebrow')}</p>
            <Heading>{copy.title}</Heading>
            {copy.shortDescription ? <p className="session-story__subtitle">{copy.shortDescription}</p> : null}
            <Link className="session-story__cta" to="/contact">{t('gallery.bookSession')}</Link>
          </MotionReveal>
        </article>;
      }) : <article className="session-story__panel">
        <BrandPhoto alt="" className="session-story__photo" immediate priority sizes="100vw" src={siteProfile.heroImageUrl} />
        <div className="session-story__shade" />
        <div className="session-story__content">
          <p className="session-story__eyebrow">{t('gallery.servicesEyebrow')}</p>
          <h1>{t('gallery.heroTitle')}</h1>
          <Link className="session-story__cta" to="/contact">{t('gallery.bookSession')}</Link>
        </div>
      </article>}
    </section>
  </PublicLayout>;
}
