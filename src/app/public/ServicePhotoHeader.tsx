import type { ServiceCard } from '../../shared/schemas/services';
import { ServicePhoto } from './ServicePhoto';

/** Shared service photo and readable title for Home and Services cards. */
export function ServicePhotoHeader({ card, className, heading, title, sizes, immediate = false, priority = false }: {
  card: ServiceCard; className: string; heading: 'h2' | 'h3'; title: string; sizes: string;
  immediate?: boolean; priority?: boolean;
}) {
  const Heading = heading;
  return <div className={`service-photo-header ${className}`}>
    <ServicePhoto card={card} className="service-photo-header__image" immediate={immediate}
      priority={priority} sizes={sizes} />
    <Heading className="service-photo-header__title">{title}</Heading>
  </div>;
}
