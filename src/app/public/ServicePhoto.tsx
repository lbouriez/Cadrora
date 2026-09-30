import { useEffect } from 'react';

import type { ServiceCard } from '../../shared/schemas/services';
import { ProgressivePhoto } from '../components';
import { BrandPhoto } from './BrandPhoto';
import { defaultServiceImage } from './serviceCatalog';

/** Shared service-card image selection for Home and Services. */
export function ServicePhoto({ card, className, sizes, immediate = false, onVisualReady, priority = false, framing }: {
  card: ServiceCard; className: string; sizes: string; immediate?: boolean; priority?: boolean;
  framing?: 'desktop' | 'mobile'; onVisualReady?: (() => void) | undefined;
}) {
  const desktop = card.photoAlignment;
  const mobile = card.mobilePhotoAlignment ?? desktop;
  const photoClass = `service-photo ${className} service-photo--${framing === 'mobile' ? mobile : desktop}`
    + (framing ? '' : ` service-photo--mobile-${mobile}`);
  const first = card.imageSources[0];
  const source = defaultServiceImage(card.id);
  useEffect(() => {
    if (!first && !source) onVisualReady?.();
  }, [first, onVisualReady, source]);
  if (first) return <ProgressivePhoto alt="" className={photoClass} height={first.height} immediate={immediate}
    lazyPreview onVisualReady={onVisualReady} priority={priority} sizes={sizes} sources={card.imageSources} width={first.width} />;
  return source ? <BrandPhoto alt="" className={photoClass} immediate={immediate} onVisualReady={onVisualReady} priority={priority} sizes={sizes} src={source} /> : null;
}
