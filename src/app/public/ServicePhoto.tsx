import type { ServiceCard } from '../../shared/schemas/services';
import { ProgressivePhoto } from '../components';
import { BrandPhoto } from './BrandPhoto';
import { defaultServiceImage } from './serviceCatalog';

/** Shared service-card image selection for Home and Services. */
export function ServicePhoto({ card, className, sizes, immediate = false, priority = false, framing }: {
  card: ServiceCard; className: string; sizes: string; immediate?: boolean; priority?: boolean;
  framing?: 'desktop' | 'mobile';
}) {
  const desktop = card.photoAlignment;
  const mobile = card.mobilePhotoAlignment ?? desktop;
  const photoClass = `service-photo ${className} service-photo--${framing === 'mobile' ? mobile : desktop}`
    + (framing ? '' : ` service-photo--mobile-${mobile}`);
  const first = card.imageSources[0];
  if (first) return <ProgressivePhoto alt="" className={photoClass} height={first.height} immediate={immediate}
    priority={priority} sizes={sizes} sources={card.imageSources} width={first.width} />;
  const source = defaultServiceImage(card.id);
  return source ? <BrandPhoto alt="" className={photoClass} immediate={immediate} priority={priority} sizes={sizes} src={source} /> : null;
}
