import type { SiteSettings } from './schemas/site';

/** Full-width editorial Home accepts the same 5% density tolerance as measured photos.
 * The preload and renderer must use identical candidates AND sizes for cache reuse. */
export const HOME_HERO_RESPONSIVE_SIZES = '95vw';

export function homeHeroSources(settings?: Pick<SiteSettings,
  'homeHeroImageRevision' | 'homeHeroImageMediumWidth' | 'homeHeroImageLargeWidth'>) {
  const path = settings?.homeHeroImageRevision
    ? `/service-media/home-hero/${settings.homeHeroImageRevision}` : '/home-hero-image';
  return [
    { url: `${path}/preview`, width: 320 },
    { url: `${path}/small`, width: 640 },
    { url: `${path}/medium`, width: settings?.homeHeroImageMediumWidth ?? 960 },
    { url: `${path}/large`, width: settings?.homeHeroImageLargeWidth ?? 1280 },
  ];
}
