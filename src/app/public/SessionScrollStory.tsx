import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Spinner, VerticalStorySlider } from '../components';
import { getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { SessionStoryContent } from './SessionStoryContent';
import { siteProfile } from './siteProfile';
import { usePublicServiceCatalog } from './usePublicServiceCatalog';

/** Present owner-managed Home sessions through the shared vertical slider. */
export function SessionScrollStory() {
  const { t } = useTranslation();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = usePublicServiceCatalog(settings);
  const sessions = services.cards.filter((card) => card.enabled && card.showOnHome);
  if (services.isPending) return <PublicLayout immersiveFooterVisible={false}>
    <section aria-busy="true" aria-label={t('gallery.services')} className="session-story session-story--loading">
      <Spinner label={t('gallery.servicesLoading')} />
    </section>
  </PublicLayout>;
  const slides = sessions.length ? sessions.map((card, index) => ({
    id: card.id,
    content: <SessionStoryContent card={card} heading={index === 0 ? 'h1' : 'h2'}
      immediate={index === 0} priority={index === 0} />,
  })) : [{ id: 'fallback', content: <>
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

  return <PublicLayout immersiveFooterVisible={activeSlideIndex >= slides.length - 1}>
    <VerticalStorySlider allowDocumentScrollAtEdges={false} className="session-story" label={t('gallery.services')}
      motionPreference="always" onActiveIndexChange={setActiveSlideIndex} slideClassName="session-story__panel" slides={slides} />
  </PublicLayout>;
}
