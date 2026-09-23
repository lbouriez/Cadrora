import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { PublicEvent } from '../../shared/schemas/gallery';
import { MotionReveal } from '../components';

function eventVisual(slug: string): { className: string; src: string } {
  if (slug === 'find-your-photos') return { className: 'event-card__visual--ai', src: '/brand/demo-ai-cover.webp' };
  if (slug === 'lumiere-et-promesses') return { className: 'event-card__visual--wedding', src: '/brand/demo-hero.webp' };
  return { className: 'event-card__visual--story', src: '/brand/demo-services-triptych.png' };
}

/** Shared live-gallery cards used by the landing and events pages. */
export function PublicEventCards({ events, language }: { events: PublicEvent[] | undefined; language: string }) {
  const { t } = useTranslation();
  return (
    <div className="event-list">
      {events?.map((event, index) => {
        const visual = eventVisual(event.slug);
        return (
          <MotionReveal as="article" className="event-card" delay={(index % 3) as 0 | 1 | 2} key={event.id}>
            <div className={`event-card__visual ${visual.className}`}>
              <img alt="" loading="lazy" src={visual.src} />
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
