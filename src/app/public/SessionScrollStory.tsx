import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Keyboard, Mousewheel, Parallax } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { MotionReveal } from '../components';
import { getPublicServices, getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { ServicePhoto } from './ServicePhoto';
import { fallbackServices, serviceText } from './serviceCatalog';
import { siteProfile } from './siteProfile';
/** Present owner-managed Home sessions with full-height vertical Swiper transitions. */
export function SessionScrollStory() {
  const { i18n, t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const sessions = (services.data ?? fallbackServices(settings.data?.enabledServices))
    .filter((card) => card.enabled && card.showOnHome);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const currentIndex = Math.min(activeIndex, Math.max(0, sessions.length - 1));

  return <PublicLayout>
    <section aria-label={t('gallery.services')} className="session-story">
      <Swiper
        className="session-story__swiper"
        direction="vertical"
        followFinger={false}
        keyboard={{ enabled: true, onlyInViewport: true }}
        longSwipes={false}
        modules={[Keyboard, Mousewheel, Parallax]}
        mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        parallax={!reducedMotion}
        preventInteractionOnTransition
        speed={reducedMotion ? 0 : 1200}
        touchReleaseOnEdges
      >
      {sessions.length ? sessions.map((card, index) => {
        const copy = serviceText(card, language, (key) => t(key));
        const Heading = index === 0 ? 'h1' : 'h2';
        return <SwiperSlide className="session-story__panel" inert={index !== currentIndex} key={card.id} tag="article">
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
        </SwiperSlide>;
      }) : <SwiperSlide className="session-story__panel" tag="article">
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
      </SwiperSlide>}
      </Swiper>
    </section>
  </PublicLayout>;
}
