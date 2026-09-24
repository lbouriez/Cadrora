import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PublicPhoto } from '../../shared/schemas/gallery';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FavoriteButton, IconButton, InfoIcon, Modal } from '../components';

interface PhotoViewerProps {
  favoriteEnabled: boolean;
  favoritePending: boolean;
  onClose: () => void;
  onSelect: (photo: PublicPhoto) => void;
  onToggleFavorite: (photo: PublicPhoto) => void;
  photo: PublicPhoto;
  photos: PublicPhoto[];
  showMetadata: boolean;
  timezone: string;
}

function imageAttributes(photo: PublicPhoto) {
  const sources = [...photo.sources].sort((left, right) => left.width - right.width);
  const fallback = sources.at(-1);
  return {
    src: fallback?.url ?? '',
    srcSet: sources.map((source) => `${source.url} ${source.width}w`).join(', '),
  };
}

function formatCapturedAt(value: string | null, language: string, timezone: string): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'long', timeZone: timezone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'long' }).format(new Date(value));
  }
}

export function PhotoViewer({ favoriteEnabled, favoritePending, onClose, onSelect, onToggleFavorite, photo, photos, showMetadata, timezone }: PhotoViewerProps) {
  const { i18n, t } = useTranslation();
  const metadataId = useId();
  const [metadataState, setMetadataState] = useState({ open: false, photoId: photo.id });
  const metadataOpen = metadataState.photoId === photo.id && metadataState.open;
  const index = photos.findIndex((candidate) => candidate.id === photo.id);
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index >= 0 ? photos[index + 1] : undefined;
  const [carouselRef, carousel] = useEmblaCarousel({ align: 'center', loop: false });
  const capturedAt = formatCapturedAt(photo.capturedAt, i18n.language, timezone);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && previous) onSelect(previous);
      if (event.key === 'ArrowRight' && next) onSelect(next);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, onSelect, previous]);

  useEffect(() => {
    if (!carousel || index < 0) return;
    carousel.scrollTo(index, true);
  }, [carousel, index]);

  useEffect(() => {
    if (!carousel) return undefined;
    const selectPhoto = () => {
      const selected = photos[carousel.selectedScrollSnap()];
      if (selected && selected.id !== photo.id) onSelect(selected);
    };
    carousel.on('select', selectPhoto);
    return () => {
      carousel.off('select', selectPhoto);
    };
  }, [carousel, onSelect, photo.id, photos]);

  return (
    <Modal backdropClassName="modal-backdrop--photo-viewer" className="modal--photo-viewer" closeLabel={t('gallery.closeViewer')} onClose={onClose} open title={t('gallery.photoOf', { current: index + 1, total: photos.length })}>
      <div className="photo-viewer">
        <div className="photo-viewer__viewport" ref={carouselRef}>
          <div className="photo-viewer__container">
            {photos.map((candidate) => {
              const candidateImage = imageAttributes(candidate);
              const selected = candidate.id === photo.id;
              const fillsDesktop = candidate.width > candidate.height && candidate.width / candidate.height < 2;
              return (
                <div aria-hidden={!selected} className={`photo-viewer__slide${fillsDesktop ? ' photo-viewer__slide--fills-desktop' : ''}`} key={candidate.id}>
                  <img alt="" aria-hidden="true" className="photo-viewer__ambient" height={candidate.height} src={candidateImage.src} width={candidate.width} />
                  <img alt={selected ? candidate.filename : ''} className="photo-viewer__image" height={candidate.height} sizes="100vw" src={candidateImage.src} srcSet={candidateImage.srcSet} width={candidate.width} />
                </div>
              );
            })}
          </div>
        </div>
        <IconButton aria-label={t('gallery.previousPhoto')} className="photo-viewer__arrow photo-viewer__arrow--previous" disabled={!previous} onClick={() => carousel?.scrollPrev()}><ChevronLeftIcon /></IconButton>
        <IconButton aria-label={t('gallery.nextPhoto')} className="photo-viewer__arrow photo-viewer__arrow--next" disabled={!next} onClick={() => carousel?.scrollNext()}><ChevronRightIcon /></IconButton>
        {showMetadata && metadataOpen ? (
          <aside className="photo-viewer__metadata" id={metadataId}>
            <h3>{t('gallery.metadata.title')}</h3>
            <dl>
              <div><dt>{t('gallery.metadata.filename')}</dt><dd>{photo.filename}</dd></div>
              {capturedAt ? <div><dt>{t('gallery.metadata.capturedAt')}</dt><dd>{capturedAt}</dd></div> : null}
              <div><dt>{t('gallery.metadata.dimensions')}</dt><dd>{t('gallery.metadata.dimensionsValue', { width: photo.width, height: photo.height })}</dd></div>
            </dl>
          </aside>
        ) : null}
        <div className="photo-viewer__controls">
          <div aria-label={t('gallery.photoOf', { current: index + 1, total: photos.length })} className="photo-viewer__progress">
            <span style={{ width: `${((index + 1) / photos.length) * 100}%` }} />
          </div>
          {showMetadata ? (
            <IconButton
              aria-controls={metadataId}
              aria-expanded={metadataOpen}
              aria-label={metadataOpen ? t('gallery.metadata.hide') : t('gallery.metadata.show')}
              className="photo-viewer__info"
              onClick={() => setMetadataState({ open: !metadataOpen, photoId: photo.id })}
            >
              <InfoIcon />
            </IconButton>
          ) : null}
          {favoriteEnabled ? <FavoriteButton
            className="photo-viewer__favorite"
            disabled={favoritePending}
            label={t(photo.liked ? 'gallery.favorite.remove' : 'gallery.favorite.add', { filename: photo.filename })}
            liked={photo.liked}
            onToggle={() => onToggleFavorite(photo)}
          /> : null}
          {photo.downloadUrl ? <a aria-label={t('gallery.download')} className="icon-button icon-button--secondary photo-viewer__download" download href={photo.downloadUrl} title={t('gallery.download')}><DownloadIcon /></a> : null}
          <div aria-label={t('gallery.photoOf', { current: index + 1, total: photos.length })} className="photo-viewer__rail">
            {photos.map((candidate) => {
              const thumbnail = imageAttributes(candidate);
              return (
                <button aria-current={candidate.id === photo.id ? 'true' : undefined} aria-label={candidate.filename} key={candidate.id} onClick={() => onSelect(candidate)} type="button">
                  <img alt="" height={candidate.height} src={thumbnail.src} width={candidate.width} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
