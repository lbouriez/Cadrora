import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MotionReveal, VerticalStorySlider } from '../components';
import { getPublicServices, getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { ServicePhoto } from './ServicePhoto';
import { fallbackServices, serviceText } from './serviceCatalog';
import { siteProfile } from './siteProfile';

/** Present owner-managed Home sessions through the shared vertical slider. */
export function SessionScrollStory() {
  const { i18n, t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const sessions = (services.data ?? fallbackServices(settings.data?.enabledServices))
    .filter((card) => card.enabled && card.showOnHome);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';

  const slides = sessions.length ? sessions.map((card, index) => {
    const copy = serviceText(card, language, (key) => t(key));
    const Heading = index === 0 ? 'h1' : 'h2';
    return { id: card.id, content: <>
      <div className="session-story__visual" data-swiper-parallax-scale="1.1">
        <ServicePhoto card={card} className="session-story__photo" immediate={index === 0}
          priority={index === 0} sizes="100vw" />
      </div>
      <div className="session-story__shade" />
      <div className="session-story__copy" data-swiper-parallax="-200">
        <MotionReveal className="session-story__content">
          <p className="session-story__eyebrow">{t('gallery.servicesEyebrow')}</p>
          <Heading>{copy.title}</Heading>
          {copy.shortDescription ? <p className="session-story__subtitle">{copy.shortDescription}</p> : null}
          <Link className="session-story__cta" to="/contact">{t('gallery.bookSession')}</Link>
        </MotionReveal>
      </div>
    </> };
  }) : [{ id: 'fallback', content: <>
    <div className="session-story__visual" data-swiper-parallax-scale="1.1">
      <BrandPhoto alt="" className="session-story__photo" immediate priority sizes="100vw" src={siteProfile.heroImageUrl} />
    </div>
    <div className="session-story__shade" />
    <div className="session-story__copy" data-swiper-parallax="-200">
      <div className="session-story__content">
        <p className="session-story__eyebrow">{t('gallery.servicesEyebrow')}</p>
        <h1>{t('gallery.heroTitle')}</h1>
        <Link className="session-story__cta" to="/contact">{t('gallery.bookSession')}</Link>
      </div>
    </div>
  </> }];

  return <PublicLayout>
    <VerticalStorySlider className="session-story" label={t('gallery.services')}
      slideClassName="session-story__panel" slides={slides} />
  </PublicLayout>;
}
