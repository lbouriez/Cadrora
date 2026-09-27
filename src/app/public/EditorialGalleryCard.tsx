import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { MotionReveal } from '../components';

/** Image-led collection card shared by customer galleries and portfolio collections. */
export function EditorialGalleryCard({ cover, description, eyebrow, href, index, locked = false, meta, title }: {
  cover: ReactNode; description?: string | null; eyebrow?: string | null; href: string;
  index: number; locked?: boolean; meta?: string | null; title: string;
}) {
  return <MotionReveal as="article" className={`event-card${locked ? ' event-card--protected' : ''}`}
    delay={(index % 3) as 0 | 1 | 2}>
    <Link className="event-card__tap" to={href}>
      <div className={`event-card__visual${locked ? ' event-card__visual--protected' : ''}`}>{cover}</div>
      <div className="event-card__body">
        {eyebrow ? <span className="event-card__service">{eyebrow}</span> : null}
        {meta ? <p className="event-card__date">{meta}</p> : null}
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        <span aria-hidden="true" className="event-card__arrow">→</span>
      </div>
    </Link>
  </MotionReveal>;
}
