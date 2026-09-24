import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ProtectedGalleryPreview, PublicEvent } from '../../shared/schemas/gallery';
import { MotionReveal } from '../components';
import { LockIcon } from '../components/Icons';

/** Shared live-gallery cards used by the landing and events pages. */
export function PublicEventCards({ events, language, protectedGalleries = [] }: { events: PublicEvent[] | undefined; language: string; protectedGalleries?: ProtectedGalleryPreview[] }) {
  const { t } = useTranslation();
  const cards = [
    ...(events ?? []).map((event) => ({ kind: 'public' as const, event, createdAt: event.createdAt, id: event.id })),
    ...protectedGalleries.map((gallery) => ({ kind: 'protected' as const, gallery, createdAt: gallery.createdAt, id: gallery.id })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  return (
    <div className="event-list">
      {cards.map((card, index) => {
        const gallery = card.kind === 'public' ? card.event : card.gallery;
        return <MotionReveal as="article" className={`event-card${card.kind === 'protected' ? ' event-card--protected' : ''}`} delay={(index % 3) as 0 | 1 | 2} key={gallery.id}>
          <Link aria-label={t('gallery.openNamedGallery', { title: gallery.title })} className="event-card__tap" to={`/e/${card.kind === 'public' ? gallery.slug : gallery.id}`}>
            <div className={`event-card__visual${card.kind === 'protected' ? ' event-card__visual--protected' : ''}`}>
              {card.kind === 'protected' ? <><img alt="" loading="lazy" src="/brand/private-gallery-cover.webp" /><span aria-hidden="true" className="event-card__lock"><LockIcon /></span></>
                : card.event.coverPhotoUrl ? <img alt="" loading="lazy" src={card.event.coverPhotoUrl} /> : <span aria-hidden="true" className="event-card__placeholder" />}
            </div>
            <div className="event-card__body">
              <p className="event-card__date">{new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(gallery.startsAt))}</p>
              <h3>{gallery.title}</h3>
              {gallery.description ? <p>{gallery.description}</p> : null}
              <span aria-hidden="true" className="event-card__arrow">→</span>
            </div>
          </Link>
        </MotionReveal>;
      })}
    </div>
  );
}
