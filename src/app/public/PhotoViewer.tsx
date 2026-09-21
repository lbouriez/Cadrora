import useEmblaCarousel from 'embla-carousel-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { PublicPhoto } from '../../shared/schemas/gallery';
import { IconButton, Modal } from '../components';

interface PhotoViewerProps {
  onClose: () => void;
  onSelect: (photo: PublicPhoto) => void;
  photo: PublicPhoto;
  photos: PublicPhoto[];
}

function imageAttributes(photo: PublicPhoto) {
  const sources = [...photo.sources].sort((left, right) => left.width - right.width);
  const fallback = sources.at(-1);
  return {
    src: fallback?.url ?? '',
    srcSet: sources.map((source) => `${source.url} ${source.width}w`).join(', '),
  };
}

export function PhotoViewer({ onClose, onSelect, photo, photos }: PhotoViewerProps) {
  const { t } = useTranslation();
  const index = photos.findIndex((candidate) => candidate.id === photo.id);
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index >= 0 ? photos[index + 1] : undefined;
  const [carouselRef, carousel] = useEmblaCarousel({ align: 'center', loop: false });

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
              return (
                <div aria-hidden={!selected} className="photo-viewer__slide" key={candidate.id}>
                  <img alt={selected ? candidate.filename : ''} height={candidate.height} sizes="100vw" src={candidateImage.src} srcSet={candidateImage.srcSet} width={candidate.width} />
                </div>
              );
            })}
          </div>
        </div>
        <IconButton aria-label={t('gallery.previousPhoto')} className="photo-viewer__arrow photo-viewer__arrow--previous" disabled={!previous} onClick={() => carousel?.scrollPrev()}>←</IconButton>
        <IconButton aria-label={t('gallery.nextPhoto')} className="photo-viewer__arrow photo-viewer__arrow--next" disabled={!next} onClick={() => carousel?.scrollNext()}>→</IconButton>
        <div className="photo-viewer__controls">
          <div aria-label={t('gallery.photoOf', { current: index + 1, total: photos.length })} className="photo-viewer__progress">
            <span style={{ width: `${((index + 1) / photos.length) * 100}%` }} />
          </div>
          {photo.downloadUrl ? <a className="photo-viewer__download" download href={photo.downloadUrl}>{t('gallery.download')} <span aria-hidden="true">↓</span></a> : null}
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
