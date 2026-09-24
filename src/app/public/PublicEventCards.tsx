import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { PublicEvent } from '../../shared/schemas/gallery';
import { MotionReveal } from '../components';
import { LockIcon } from '../components/Icons';

/** Shared live-gallery cards used by the landing and events pages. */
export function PublicEventCards({ events, language, protectedGalleries = [] }: { events: PublicEvent[] | undefined; language: string; protectedGalleries?: { id: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="event-list">
      {events?.map((event, index) => {
        return (
          <MotionReveal as="article" className="event-card" delay={(index % 3) as 0 | 1 | 2} key={event.id}>
            <Link aria-label={t('gallery.openNamedGallery', { title: event.title })} className="event-card__tap" to={`/e/${event.slug}`}>
            <div className="event-card__visual">
              {event.coverPhotoUrl ? <img alt="" loading="lazy" src={event.coverPhotoUrl} /> : <span aria-hidden="true" className="event-card__placeholder" />}
            </div>
            <div className="event-card__body">
              <p className="event-card__date">{new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(event.startsAt))}</p>
              <h3>{event.title}</h3>
              {event.description ? <p>{event.description}</p> : null}
              <span aria-hidden="true" className="event-card__arrow">→</span>
            </div>
            </Link>
          </MotionReveal>
        );
      })}
      {protectedGalleries.map((gallery, index) => <MotionReveal as="article" className="event-card event-card--protected" delay={(index % 3) as 0 | 1 | 2} key={gallery.id}>
        <Link aria-label={t('gallery.openProtectedGallery', { number: index + 1 })} className="event-card__tap" to={`/e/${gallery.id}`}>
          <div className="event-card__visual event-card__visual--protected"><img alt="" loading="lazy" src="/brand/demo-services-triptych.png" /><span aria-hidden="true" className="event-card__lock"><LockIcon /></span></div>
          <div className="event-card__body"><p className="event-card__date">{t('gallery.privateCard.label')}</p><h3>{t('gallery.privateCard.title', { number: index + 1 })}</h3><p>{t('gallery.privateCard.description')}</p><span aria-hidden="true" className="event-card__arrow">→</span></div>
        </Link>
      </MotionReveal>)}
    </div>
  );
}
