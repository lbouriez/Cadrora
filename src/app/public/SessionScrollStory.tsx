import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Spinner } from '../components';
import { getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { SessionStoryContent } from './SessionStoryContent';
import { SessionDetailsModal } from './SessionDetailsModal';
import { serviceText } from './serviceCatalog';
import { localizedMarketingPath } from './localizedMarketingPath';
import { siteProfile } from './siteProfile';
import { usePublicServiceCatalog } from './usePublicServiceCatalog';

const loadSlider = async () => ({ default: (await import('../components/VerticalStorySlider')).VerticalStorySlider });
const VerticalStorySlider = lazy(loadSlider);

/** Present owner-managed Home sessions through the shared vertical slider. */
export function SessionScrollStory() {
  const { i18n, t } = useTranslation();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firstPhotoReady, setFirstPhotoReady] = useState(false);
  const markFirstPhotoReady = useCallback(() => setFirstPhotoReady(true), []);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = usePublicServiceCatalog(settings);
  const sessions = services.cards.filter((card) => card.enabled && card.showOnHome);
  const selectedCard = sessions.find((card) => card.id === selectedId);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  useEffect(() => {
    // The lazy boundary still handles a failed chunk; speculative warming must not reject unhandled.
    void loadSlider().catch(() => undefined);
  }, []);
  if (services.isPending) return <PublicLayout immersiveFooterVisible={false}>
    <section aria-busy="true" aria-label={t('gallery.services')} className="session-story session-story--loading">
      <Spinner label={t('gallery.servicesLoading')} />
    </section>
  </PublicLayout>;
  const slides = sessions.length ? sessions.map((card, index) => ({
    id: card.id,
    label: serviceText(card, language, (key) => t(key)).title,
    content: <SessionStoryContent card={card} heading={index === 0 ? 'h1' : 'h2'}
      immediate={index === 0} introduction={index === 0} onExplore={setSelectedId} onVisualReady={index === 0 ? markFirstPhotoReady : undefined}
      priority={index === 0} />,
  })) : [{ id: 'fallback', label: t('gallery.heroTitle'), content: <>
    <div className="session-story__visual" data-swiper-parallax-scale="1.1">
      <BrandPhoto alt="" className="session-story__photo" immediate onVisualReady={markFirstPhotoReady} priority sizes="100vw" src={siteProfile.heroImageUrl} />
    </div>
    <div className="session-story__shade" />
    <div className="session-story__copy" data-swiper-parallax="-200">
      <div className="session-story__content">
        <h1>{t('gallery.heroTitle')}</h1>
        <Link className="session-story__cta" to={localizedMarketingPath('/contact', language)}>{t('gallery.bookSession')}</Link>
      </div>
    </div>
  </> }];

  return <PublicLayout immersiveFooterVisible={activeSlideIndex >= slides.length - 1}>
    <Suspense fallback={<section className={`session-story session-story--fallback${firstPhotoReady ? '' : ' session-story--photo-loading'}`}><div className="session-story__panel">{slides[0]?.content}</div></section>}>
      <VerticalStorySlider allowDocumentScrollAtEdges={false} className={`session-story${firstPhotoReady ? '' : ' session-story--photo-loading'}`} label={t('gallery.services')}
        interactionDisabled={Boolean(selectedCard)} motionPreference="always" onActiveIndexChange={setActiveSlideIndex} showPagination
        slideClassName="session-story__panel" slides={slides} />
    </Suspense>
    <SessionDetailsModal card={selectedCard ?? null} onClose={() => setSelectedId(null)} />
  </PublicLayout>;
}
