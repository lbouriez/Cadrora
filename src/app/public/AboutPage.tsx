import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';

import { ProgressivePhoto } from '../components';
import { getPublicSiteSettings } from './api';
import { FirstFrameReveal } from './FirstFrameReveal';
import { PublicLayout } from './PublicLayout';
import { siteProfile } from './siteProfile';
import { localizedMarketingPath } from './localizedMarketingPath';

/** One owner-managed About page with presentation selected by the site profile. */
export function AboutPage() {
  const { i18n, t } = useTranslation();
  const [heroPhotoReady, setHeroPhotoReady] = useState(false);
  const markHeroPhotoReady = useCallback(() => setHeroPhotoReady(true), []);
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  if (settings.data?.aboutEnabled === false) return <Navigate replace to={localizedMarketingPath('/', i18n.language)} />;

  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const copy = settings.data?.aboutCopy?.[language];
  const title = copy?.title ?? t('gallery.aboutPage.title');
  const body = copy?.body ?? t('gallery.aboutPage.body');
  const alt = settings.data?.aboutImageRevision ? (copy?.imageAlt ?? '') : '';
  const imagePath = settings.data?.aboutImageRevision
    ? `/service-media/about-hero/${settings.data.aboutImageRevision}` : '/about-hero-image';
  const sources = [
    { url: `${imagePath}/preview`, width: 320 },
    { url: `${imagePath}/small`, width: 640 },
    { url: `${imagePath}/medium`, width: settings.data?.aboutImageMediumWidth ?? 960 },
    { url: `${imagePath}/large`, width: settings.data?.aboutImageLargeWidth ?? 1280 },
  ];
  const immersive = siteProfile.home.presentation === 'session-slides';

  const page = <PublicLayout fullBleed={immersive} pageTitle={title}>
    <article className={`about-page${immersive ? ' about-page--immersive' : ''}`}>
      <div className="about-page__hero">
        <ProgressivePhoto alt={alt} className="about-page__image" enabled={!settings.isPending} height={853} immediate
          onVisualReady={immersive ? markHeroPhotoReady : undefined} priority sizes={immersive ? '100vw' : '(max-width: 48rem) 100vw, 48vw'}
          sources={sources} visualReadyAt="display" width={1280} />
        <div className="about-page__hero-copy">
          <h1>{title}</h1>
          <Link className="about-page__action" to={localizedMarketingPath('/contact', language)}>{t('gallery.bookSession')}</Link>
        </div>
      </div>
      <section aria-label={title} className="about-page__story">
        <p>{body}</p>
      </section>
    </article>
  </PublicLayout>;
  if (!immersive) return page;
  const ready = !settings.isPending && heroPhotoReady;
  return <div className={`session-home${ready ? '' : ' session-home--pending'}`}>
    <FirstFrameReveal ready={ready}>{page}</FirstFrameReveal>
  </div>;
}
