import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PortfolioItemsSchema } from '../../shared/schemas/portfolio';
import type { PortfolioItem } from '../../shared/schemas/portfolio';
import { MotionReveal, ProgressivePhoto } from '../components';
import { getPublicServices, getPublicSiteSettings } from './api';
import { PublicLayout } from './PublicLayout';
import { defaultServiceImage, fallbackServices, serviceText } from './serviceCatalog';
import { ServicePhoto } from './ServicePhoto';

async function getPortfolio(): Promise<PortfolioItem[]> {
  const response = await fetch('/api/v1/portfolio');
  if (!response.ok) throw new Error(`Portfolio returned ${response.status}`);
  return PortfolioItemsSchema.parse(await response.json());
}

export function PortfolioPage() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const portfolio = useQuery({ queryFn: getPortfolio, queryKey: ['public-portfolio'], retry: false, staleTime: 60_000 });
  const visibleServices = (services.data ?? fallbackServices(settings.data?.enabledServices)).filter((service) => service.enabled);
  return <PublicLayout>
    <MotionReveal as="header" className="editorial-heading">
      <p className="site-eyebrow">{t('gallery.portfolio')}</p>
      <h1>{t('gallery.portfolioPage.title')}</h1>
      <p>{t('gallery.portfolioPage.lead')}</p>
    </MotionReveal>
    {visibleServices.length ? <nav aria-label={t('gallery.portfolioPage.categories')} className="portfolio-categories">
      {visibleServices.map((service) => <a href={`#portfolio-${service.id}`} key={service.id}>
        {serviceText(service, language, (key) => t(key)).title}
      </a>)}
    </nav> : null}
    {visibleServices.map((service) => {
      const copy = serviceText(service, language, (key) => t(key));
      const photos = portfolio.data?.filter((photo) => photo.serviceId === service.id) ?? [];
      const hasServiceImage = service.imageSources.length > 0 || Boolean(defaultServiceImage(service.id));
      return <MotionReveal as="section" className="portfolio-section" id={`portfolio-${service.id}`} key={service.id}>
        <div className="portfolio-section__heading"><h2>{copy.title}</h2><p>{copy.shortDescription}</p></div>
        {photos.length ? <div className="portfolio-photo-grid">
          {photos.map((photo) => {
            const largest = photo.imageSources.at(-1);
            if (!largest) return null;
            return <figure className="portfolio-photo" key={photo.id}>
              <ProgressivePhoto alt={photo.alt[language]} className="portfolio-photo__image" height={largest.height}
                lazyPreview sizes="(max-width: 48rem) 100vw, 50vw" sources={photo.imageSources} width={largest.width} />
            </figure>;
          })}
        </div> : <div className="portfolio-section__example">
          {hasServiceImage
            ? <ServicePhoto card={service} className="portfolio-section__example-image" sizes="(max-width: 48rem) 100vw, 60vw" /> : null}
          <p>{t(hasServiceImage ? 'gallery.portfolioPage.example' : 'gallery.portfolioPage.empty')}</p>
        </div>}
        <Link className="button button--secondary" to="/services">{t('gallery.portfolioPage.serviceAction')}</Link>
      </MotionReveal>;
    })}
    {portfolio.isError ? <p className="gallery-notice" role="status">{t('gallery.portfolioPage.unavailable')}</p> : null}
  </PublicLayout>;
}
