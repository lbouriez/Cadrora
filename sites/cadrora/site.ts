import type { SiteDefinition } from '../../src/app/site/types';
import profile from './profile.json';

export const cadroraSite = {
  id: 'cadrora',
  name: 'Cadrora',
  description: {
    fr: 'Cadrora, photographie d’événements et galeries privées élégantes.',
    en: 'Cadrora, event photography and elegant private galleries.',
  },
  logoUrl: '/brand/cadrora-logo.png',
  heroImageUrl: profile.heroImageUrl,
  heroAccentImageUrl: '/demo/face-search/test-portrait-amelia.webp',
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
    primaryAction: { href: '/e/find-your-photos/find', labelKey: 'gallery.tryAi', shortLabelKey: 'gallery.tryAiShort' },
    secondaryAction: { href: '#galleries', labelKey: 'gallery.discoverGalleries', shortLabelKey: 'gallery.discoverGalleriesShort' },
    sections: ['demo', 'stack', 'services', 'approach', 'galleries', 'contact'],
    showProof: true,
  },
  demo: {
    adminPassword: 'cadrora-demo',
    adminUsername: 'demo',
    privateGalleryPassword: 'cadrora-demo',
    privateGallerySlug: 'instants-en-famille',
    publicGallerySlug: 'lumiere-et-promesses',
  },
  copy: { en: {}, fr: {} },
} as const satisfies SiteDefinition;

export default cadroraSite;
