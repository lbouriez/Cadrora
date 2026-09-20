import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { PublicPhoto } from '../../shared/schemas/gallery';
import { Button, Modal } from '../components';

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
    <Modal closeLabel={t('gallery.closeViewer')} onClose={onClose} open title={t('gallery.photoOf', { current: index + 1, total: photos.length })}>
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
        <img alt={photo.filename} height={photo.height} sizes="100vw" src={image.src} srcSet={image.srcSet} width={photo.width} />
        <div className="photo-viewer__actions">
          <Button aria-label={t('gallery.previousPhoto')} disabled={!previous} onClick={() => previous && onSelect(previous)} variant="secondary">←</Button>
          {photo.downloadUrl ? <a className="button button--primary" download href={photo.downloadUrl}>{t('gallery.download')}</a> : null}
          <Button aria-label={t('gallery.nextPhoto')} disabled={!next} onClick={() => next && onSelect(next)} variant="secondary">→</Button>
        </div>
      </div>
    </Modal>
  );
}
