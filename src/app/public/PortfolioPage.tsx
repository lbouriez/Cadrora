import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { PortfolioCollectionDetailSchema, PortfolioCollectionsSchema } from '../../shared/schemas/portfolio';
import type { PortfolioCollection, PortfolioItem } from '../../shared/schemas/portfolio';
import { BackLink, MotionReveal, ProgressivePhoto, Spinner } from '../components';
import { EditorialGalleryCard } from './EditorialGalleryCard';
import { getPublicServices } from './api';
import { PhotoViewer } from './PhotoViewer';
import type { ViewerPhoto } from './PhotoViewer';
import { PublicLayout } from './PublicLayout';
import { serviceText } from './serviceCatalog';
import { usePhotoColumns } from './usePhotoColumns';

async function getCollections(): Promise<PortfolioCollection[]> {
  const response = await fetch('/api/v1/portfolio');
  if (!response.ok) throw new Error(`Portfolio returned ${response.status}`);
  return PortfolioCollectionsSchema.parse(await response.json());
}

async function getCollection(slug: string) {
  const response = await fetch(`/api/v1/portfolio/${encodeURIComponent(slug)}`);
  if (!response.ok) throw new Error(`Portfolio returned ${response.status}`);
  return PortfolioCollectionDetailSchema.parse(await response.json());
}

function collectionPhoto(photo: PortfolioItem, language: 'fr' | 'en'): ViewerPhoto | null {
  const largest = photo.imageSources.at(-1);
  if (!largest) return null;
  return {
    id: photo.id, filename: photo.alt[language], width: largest.width, height: largest.height,
    revision: 0, sources: photo.imageSources,
  };
}

export function PortfolioPage() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const collections = useQuery({ queryFn: getCollections, queryKey: ['public-portfolio'], retry: false, staleTime: 60_000 });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  return <PublicLayout pageTitle={t('gallery.portfolio')}>
    <MotionReveal as="header" className="editorial-heading">
      <p className="site-eyebrow">{t('gallery.portfolio')}</p>
      <h1>{t('gallery.portfolioPage.title')}</h1>
      <p>{t('gallery.portfolioPage.lead')}</p>
    </MotionReveal>
    {collections.isPending ? <Spinner label={t('gallery.loading')} /> : null}
    {collections.isError ? <p className="gallery-notice" role="status">{t('gallery.portfolioPage.unavailable')}</p> : null}
    {collections.data?.length === 0 ? <p className="gallery-notice">{t('gallery.portfolioPage.emptyCollections')}</p> : null}
    <div className="event-list">
      {collections.data?.map((collection, index) => {
        const cover = collection.coverSources.at(-1);
        const service = services.data?.find((candidate) => candidate.id === collection.serviceId);
        return <EditorialGalleryCard cover={cover ? <ProgressivePhoto alt="" height={cover.height}
          immediate={index < 2} priority={index === 0} sizes="(min-width: 75rem) 36rem, (min-width: 48rem) 50vw, 100vw"
          sources={collection.coverSources} width={cover.width} /> : <span aria-hidden="true" className="event-card__placeholder" />}
          description={collection.copy[language].description}
          eyebrow={service
            ? serviceText(service, language, (key) => t(key)).title
            : t(`gallery.category.${collection.serviceId}`, { defaultValue: collection.copy[language].title })}
          href={`/portfolio/${collection.slug}`} index={index} key={collection.id}
          title={collection.copy[language].title} />;
      })}
    </div>
  </PublicLayout>;
}

export function PortfolioDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const collection = useQuery({
    enabled: Boolean(slug), queryFn: () => getCollection(slug ?? ''), queryKey: ['public-portfolio', slug], retry: false,
  });
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  const photos = useMemo(() => collection.data?.photos
    .map((photo) => collectionPhoto(photo, language)).filter((photo): photo is ViewerPhoto => photo !== null) ?? [],
  [collection.data, language]);
  const { columns, columnWidths, gridRef } = usePhotoColumns(photos);
  const selected = photos.find((photo) => photo.id === searchParams.get('photo'));
  const service = services.data?.find((candidate) => candidate.id === collection.data?.serviceId);
  return <PublicLayout
    {...(collection.data ? {
      pageDescription: collection.data.copy[language].description,
      pageTitle: collection.data.copy[language].title,
    } : {})}>
    <BackLink to="/portfolio">{t('gallery.backPortfolio')}</BackLink>
    {collection.isPending ? <Spinner label={t('gallery.loading')} /> : null}
    {collection.isError ? <p className="gallery-notice" role="alert">{t('gallery.portfolioPage.unavailable')}</p> : null}
    {collection.data ? <>
      <MotionReveal as="header" className="editorial-heading">
        <p className="site-eyebrow">{service
          ? serviceText(service, language, (key) => t(key)).title
          : t(`gallery.category.${collection.data.serviceId}`, { defaultValue: collection.data.copy[language].title })}</p>
        <h1>{collection.data.copy[language].title}</h1>
        {collection.data.copy[language].description ? <p>{collection.data.copy[language].description}</p> : null}
      </MotionReveal>
      <div className="photo-grid" ref={gridRef}
        style={{ gridTemplateColumns: columnWidths.map((width) => `minmax(0, ${width}fr)`).join(' ') }}>
        {columns.map((column, columnIndex) => <div className="photo-grid__column" key={columnIndex}>
          {column.map((photo, photoIndex) => <Link aria-label={photo.filename} className="photo-tile" key={photo.id}
            to={`?photo=${encodeURIComponent(photo.id)}`}>
            <ProgressivePhoto alt={photo.filename} height={photo.height} immediate={photoIndex === 0}
              priority={columnIndex === 0 && photoIndex === 0}
              sizes="(max-width: 45rem) 100vw, (max-width: 82rem) 50vw, 33vw"
              sources={photo.sources} width={photo.width} />
          </Link>)}
        </div>)}
      </div>
      {selected ? <PhotoViewer favoriteEnabled={false} favoritePending={false} onClose={() => setSearchParams({}, { replace: true })}
        onSelect={(photo) => setSearchParams({ photo: photo.id }, { replace: true })}
        onToggleFavorite={() => undefined} onToggleRetouch={() => undefined} photo={selected} photos={photos}
        retouchEnabled={false} retouchPending={false} showMetadata={false} timezone="UTC" /> : null}
    </> : null}
  </PublicLayout>;
}
