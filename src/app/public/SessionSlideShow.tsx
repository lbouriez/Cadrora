import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { getPublicServices, getPublicSiteSettings } from './api';
import { BrandPhoto } from './BrandPhoto';
import { PublicLayout } from './PublicLayout';
import { ServicePhoto } from './ServicePhoto';
import { fallbackServices, serviceText } from './serviceCatalog';
import { siteProfile } from './siteProfile';

/** A presentation of the same ordered, owner-managed Home sessions used by the card layout. */
export function SessionSlideShow() {
  const { i18n, t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const slides = (services.data ?? fallbackServices(settings.data?.enabledServices))
    .filter((card) => card.enabled && card.showOnHome)
    .slice(0, settings.data?.homeServicesLimit ?? 3);
  const [active, setActive] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const activeIndex = slides.length ? active % slides.length : 0;
  const nextIndex = slides.length ? (activeIndex + 1) % slides.length : 0;
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';

  const show = (index: number) => {
    if (index === activeIndex) return;
    setOutgoing(activeIndex);
    setActive(index);
  };

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return;
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      setOutgoing(activeIndex);
      setActive(nextIndex);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, nextIndex, reducedMotion, slides.length]);

  useEffect(() => {
    if (outgoing === null) return;
    const timer = window.setTimeout(() => setOutgoing(null), 1100);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  const current = slides[activeIndex];
  const currentCopy = current ? serviceText(current, language, (key) => t(key)) : null;
  const rendered = [...new Set([activeIndex, nextIndex, outgoing].filter((index): index is number =>
    index !== null && index < slides.length))];

  return <PublicLayout>
    <section aria-label={t('gallery.services')} className="session-slideshow">
      {slides.length ? rendered.map((index) => {
        const card = slides[index];
        if (!card) return null;
        return <div aria-hidden="true" className={`session-slideshow__slide${index === activeIndex ? ' session-slideshow__slide--active' : ''}`}
          key={card.id}>
          <ServicePhoto card={card} className="session-slideshow__photo" immediate priority={index === activeIndex && activeIndex === 0} sizes="100vw" />
        </div>;
      }) : <BrandPhoto alt="" className="session-slideshow__photo session-slideshow__fallback"
        immediate priority sizes="100vw" src={siteProfile.heroImageUrl} />}
      <div className="session-slideshow__shade" />
      <div className="session-slideshow__content" key={current?.id ?? 'fallback'}>
        <p className="session-slideshow__eyebrow">{t('gallery.servicesEyebrow')}</p>
        <h1>{currentCopy?.title ?? t('gallery.heroTitle')}</h1>
        {currentCopy?.shortDescription ? <p className="session-slideshow__subtitle">{currentCopy.shortDescription}</p> : null}
        <Link className="session-slideshow__cta" to="/contact">{t('gallery.bookSession')}</Link>
      </div>
      {slides.length > 1 ? <>
        <button aria-label={t('gallery.previousSession')} className="session-slideshow__arrow session-slideshow__arrow--previous"
          onClick={() => show((activeIndex - 1 + slides.length) % slides.length)} type="button">‹</button>
        <button aria-label={t('gallery.nextSession')} className="session-slideshow__arrow session-slideshow__arrow--next"
          onClick={() => show(nextIndex)} type="button">›</button>
      </> : null}
    </section>
  </PublicLayout>;
}
