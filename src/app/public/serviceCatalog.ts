import type { ServiceKey } from '../../shared/schemas/site';
import type { ServiceCard } from '../../shared/schemas/services';
import { siteProfile } from './siteProfile';

/** Local demo visuals; operators can replace these repository assets for their own studio. */
export const serviceVisuals = [
  { key: 'wedding', src: siteProfile.serviceImages.wedding },
  { key: 'family', src: siteProfile.serviceImages.family },
  { key: 'brand', src: siteProfile.serviceImages.brand },
  { key: 'corporate', src: siteProfile.serviceImages.corporate },
  { key: 'children', src: siteProfile.serviceImages.children },
] as const satisfies readonly { key: ServiceKey; src: string }[];

/** Compiled cards keep marketing pages useful when the optional D1 catalog is unavailable. */
export function fallbackServices(enabled?: readonly ServiceKey[]): ServiceCard[] {
  return serviceVisuals.map(({ key }, sortOrder) => ({
    id: key, isBuiltin: true, sortOrder, enabled: enabled?.includes(key) ?? true,
    showOnHome: true, copy: null, imageRevision: null, imageSources: [],
  }));
}

export function defaultServiceImage(id: string): string | null {
  return serviceVisuals.find((item) => item.key === id)?.src ?? null;
}

export function serviceText(card: ServiceCard, language: 'fr' | 'en', translate: (key: string) => string) {
  const copy = card.copy?.[language];
  return {
    title: copy?.title ?? translate(`gallery.servicesPage.${card.id}.title`),
    shortDescription: copy?.shortDescription ?? translate(`gallery.servicesPage.${card.id}.body`),
    description: copy?.description ?? translate(`gallery.servicesPage.${card.id}.body`),
    points: copy?.points ?? [1, 2, 3].map((number) => translate(`gallery.servicesPage.${card.id}.point${number}`)),
    duration: copy?.duration ?? '',
    priceRange: copy?.priceRange ?? '',
    details: copy?.details ?? '',
  };
}
