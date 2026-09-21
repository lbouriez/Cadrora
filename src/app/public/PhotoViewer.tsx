import { useEffect, useRef } from 'react';
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
  const touchStart = useRef<number | null>(null);
  const index = photos.findIndex((candidate) => candidate.id === photo.id);
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index >= 0 ? photos[index + 1] : undefined;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && previous) onSelect(previous);
      if (event.key === 'ArrowRight' && next) onSelect(next);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, onSelect, previous]);

  const image = imageAttributes(photo);
  return (
    <Modal className="modal--photo-viewer" closeLabel={t('gallery.closeViewer')} onClose={onClose} open title={t('gallery.photoOf', { current: index + 1, total: photos.length })}>
      <div
        className="photo-viewer"
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined || Math.abs(end - start) < 50) return;
          if (end > start && previous) onSelect(previous);
          if (end < start && next) onSelect(next);
        }}
        onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
      >
        <div className="photo-viewer__stage">
          <img alt={photo.filename} height={photo.height} sizes="(min-width: 70rem) 80vw, 100vw" src={image.src} srcSet={image.srcSet} width={photo.width} />
          <IconButton aria-label={t('gallery.previousPhoto')} className="photo-viewer__arrow photo-viewer__arrow--previous" disabled={!previous} onClick={() => previous && onSelect(previous)}>←</IconButton>
          <IconButton aria-label={t('gallery.nextPhoto')} className="photo-viewer__arrow photo-viewer__arrow--next" disabled={!next} onClick={() => next && onSelect(next)}>→</IconButton>
        </div>
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
