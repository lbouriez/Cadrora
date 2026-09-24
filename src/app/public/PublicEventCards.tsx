import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { PublicEvent } from '../../shared/schemas/gallery';
import { MotionReveal } from '../components';

/** Shared live-gallery cards used by the landing and events pages. */
export function PublicEventCards({ events, language }: { events: PublicEvent[] | undefined; language: string }) {
  const { t } = useTranslation();
  return (
    <div className="event-list">
      {events?.map((event, index) => {
        return (
          <MotionReveal as="article" className="event-card" delay={(index % 3) as 0 | 1 | 2} key={event.id}>
            <div className="event-card__visual">
              {event.coverPhotoUrl ? <img alt="" loading="lazy" src={event.coverPhotoUrl} /> : <span aria-hidden="true" className="event-card__placeholder" />}
            </div>
            <div className="event-card__body">
              <p className="event-card__date">{new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(event.startsAt))}</p>
              <h3>{event.title}</h3>
              {event.description ? <p>{event.description}</p> : null}
              <Link className="button button--secondary event-card__link" to={`/e/${event.slug}`}>{t('gallery.openEvent')} <span aria-hidden="true">→</span></Link>
            </div>
          </MotionReveal>
        );
      })}
    </div>
  );
}
