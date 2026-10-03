import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { VerticalStorySlider } from '../components/VerticalStorySlider';
import { getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { SessionStoryContent } from './SessionStoryContent';
import { SessionDetailsModal } from './SessionDetailsModal';
import { serviceText } from './serviceCatalog';
import { localizedMarketingPath } from './localizedMarketingPath';
import { siteProfile } from './siteProfile';
import { SiteStartup } from './SiteStartup';
import { usePublicServiceCatalog } from './usePublicServiceCatalog';

/** Present owner-managed Home sessions through the shared vertical slider. */
export function SessionScrollStory() {
  const { i18n, t } = useTranslation();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firstPhotoReady, setFirstPhotoReady] = useState(false);
  const [Slider, setSlider] = useState<typeof VerticalStorySlider | null>(null);
  const [sliderReady, setSliderReady] = useState(false);
  const [sliderFailed, setSliderFailed] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const markFirstPhotoReady = useCallback(() => setFirstPhotoReady(true), []);
  const markSliderReady = useCallback(() => setSliderReady(true), []);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = usePublicServiceCatalog(settings);
  const sessions = services.cards.filter((card) => card.showOnHome);
  const selectedCard = sessions.find((card) => card.id === selectedId);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  useEffect(() => {
    let active = true;
    // Fetch code/CSS alongside the catalog. Mount photos only in the final slider,
    // never in a temporary Suspense tree that would restart decoding and animation.
    void import('../components/VerticalStorySlider').then((module) => {
      if (active) setSlider(() => module.VerticalStorySlider);
    }).catch(() => { if (active) setSliderFailed(true); });
    const displayFont = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
    void (document.fonts && displayFont ? document.fonts.load(`400 1em ${displayFont}`) : Promise.resolve())
      .catch(() => undefined).then(() => { if (active) setFontReady(true); });
    return () => { active = false; };
  }, []);
  const ready = !settings.isPending && !services.isPending && sliderReady && firstPhotoReady && fontReady;
  const slides = sessions.length ? sessions.map((card, index) => ({
    id: card.id,
    label: serviceText(card, language, (key) => t(key)).title,
    content: <SessionStoryContent card={card} heading={index === 0 ? 'h1' : 'h2'}
      immediate={index === 0} introduction={index === 0} onExplore={setSelectedId} onVisualReady={index === 0 ? markFirstPhotoReady : undefined}
      priority={index === 0} />,
  })) : [{ id: 'fallback', label: t('gallery.heroTitle'), content: <>
    <div className="session-story__visual" data-swiper-parallax-scale="1.1">
      <BrandPhoto alt="" className="session-story__photo" immediate onVisualReady={markFirstPhotoReady} visualReadyAt="display" priority sizes="100vw" src={siteProfile.heroImageUrl} />
    </div>
    <div className="session-story__shade" />
    <div className="session-story__copy" data-swiper-parallax="-200">
      <div className="session-story__content">
        <h1>{t('gallery.heroTitle')}</h1>
        <Link className="session-story__cta" to={localizedMarketingPath('/contact', language)}>{t('gallery.bookSession')}</Link>
      </div>
    </div>
  </> }];

  return <div className="session-home">
    {!ready ? <SiteStartup failed={sliderFailed} /> : null}
    <div aria-hidden={!ready || undefined} className={`session-home__stage${ready ? '' : ' session-home__stage--pending'}`} inert={!ready}>
      <PublicLayout immersiveFooterVisible={ready && activeSlideIndex >= slides.length - 1}>
        {Slider && !services.isPending ? <Slider allowDocumentScrollAtEdges={false} className="session-story" label={t('gallery.services')}
          interactionDisabled={!ready || Boolean(selectedCard)} motionPreference="always" onActiveIndexChange={setActiveSlideIndex}
          onReady={markSliderReady} showPagination slideClassName="session-story__panel" slides={slides} /> : null}
        <SessionDetailsModal card={selectedCard ?? null} onClose={() => setSelectedId(null)} />
      </PublicLayout>
    </div>
  </div>;
}
