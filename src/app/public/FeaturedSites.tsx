import { useTranslation } from 'react-i18next';

import { MotionReveal } from '../components';
import type { FeaturedSite } from '../site/types';

export function FeaturedSites({ sites }: { sites: readonly FeaturedSite[] }) {
  const { t } = useTranslation();
  if (sites.length === 0) return null;

  return <MotionReveal as="section" labelledBy="featured-sites-title" className="site-section featured-sites">
    <div className="site-section__heading">
      <p className="site-eyebrow">{t('gallery.featuredSites.eyebrow')}</p>
      <h2 id="featured-sites-title">{t('gallery.featuredSites.title')}</h2>
      <p>{t('gallery.featuredSites.lead')}</p>
    </div>
    <div className="featured-sites__grid">
      {sites.map((site) => <a className="featured-site-card" href={site.href} key={site.href} rel="noopener" target="_blank">
        {site.logoUrl ? <img alt="" className="featured-site-card__logo" height="80" loading="lazy" src={site.logoUrl} width="80" /> : null}
        <div className="featured-site-card__copy">
          <h3>{site.name}</h3>
          <p>{t(site.descriptionKey)}</p>
          <span className="featured-site-card__action">{t('gallery.featuredSites.visit')} <span aria-hidden="true">↗</span></span>
        </div>
      </a>)}
    </div>
  </MotionReveal>;
}
