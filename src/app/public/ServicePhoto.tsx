import type { ServiceCard } from '../../shared/schemas/services';
import { ProgressivePhoto } from '../components';
import { BrandPhoto } from './BrandPhoto';
import { defaultServiceImage } from './serviceCatalog';

/** Shared service-card image selection for Home and Services. */
export function ServicePhoto({ card, className, sizes, immediate = false, priority = false }: {
  card: ServiceCard; className: string; sizes: string; immediate?: boolean; priority?: boolean;
}) {
  const first = card.imageSources[0];
  if (first) return <ProgressivePhoto alt="" className={className} height={first.height} immediate={immediate}
    priority={priority} sizes={sizes} sources={card.imageSources} width={first.width} />;
  const source = defaultServiceImage(card.id);
  return source ? <BrandPhoto alt="" className={className} immediate={immediate} priority={priority} sizes={sizes} src={source} /> : null;
}
