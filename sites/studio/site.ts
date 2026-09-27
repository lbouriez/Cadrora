import type { SiteDefinition } from '../../src/app/site/types';
import profile from './profile.json';

/** Neutral starting profile for a new independent photographer deployment. */
export const studioSite = {
  id: 'studio',
  name: 'Studio photo',
  description: {
    fr: 'Studio photo, portraits et galeries privées.',
    en: 'Photo studio, portraits and private galleries.',
  },
  logoUrl: null,
  heroImageUrl: profile.heroImageUrl,
  heroAccentImageUrl: null,
  mapPreviewUrl: '/brand/service-area-preview.webp',
  privateGalleryCoverUrl: '/brand/private-gallery-cover.webp',
  serviceImages: {
    wedding: '/brand/demo-hero.webp',
    family: '/brand/demo-services-triptych.webp',
    brand: '/brand/service-brand.webp',
    corporate: '/brand/service-corporate.webp',
    children: '/brand/service-children.webp',
  },
  home: {
    primaryAction: { href: '/contact', labelKey: 'gallery.contactCalloutAction', shortLabelKey: 'gallery.contactCalloutAction' },
    secondaryAction: { href: '#galleries', labelKey: 'gallery.discoverGalleries', shortLabelKey: 'gallery.discoverGalleriesShort' },
    sections: ['services', 'approach', 'galleries', 'contact'],
    showProof: false,
  },
  demo: null,
  copy: { fr: {}, en: {} },
} as const satisfies SiteDefinition;

export default studioSite;
