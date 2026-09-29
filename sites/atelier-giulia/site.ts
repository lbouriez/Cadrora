import type { SiteDefinition } from '../../src/app/site/types';
import profile from './profile.json';

/** Temporary, repository-owned showcase imagery; replace it with licensed Atelier Giulia work. */
export const atelierGiuliaSite = {
  id: 'atelier-giulia',
  name: 'Atelier Giulia',
  description: {
    fr: 'Atelier Giulia, portraits, célébrations et galeries photo.',
    en: 'Portrait and celebration photography by Atelier Giulia. Explore our photo galleries.',
  },
  logoUrl: '/brand/atelier-giulia-logo.png',
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
  navigation: ['portfolio', 'services', 'about', 'contact'],
  home: {
    presentation: 'session-slides',
    primaryAction: { href: '/contact', labelKey: 'gallery.contactCalloutAction', shortLabelKey: 'gallery.contactCalloutAction' },
    secondaryAction: { href: '#services', labelKey: 'gallery.services', shortLabelKey: 'gallery.services' },
    sections: ['services', 'approach', 'galleries', 'contact'],
    showProof: false,
  },
  demo: null,
  copy: {
    en: { gallery: {
      heroEyebrow: 'Photography for the moments that matter',
      heroTitle: 'Your story, seen with care.',
      heroLead: 'Atelier Giulia brings a gentle eye to celebrations, portraits, and the people you love. Explore the work and tell us what you are imagining.',
      heroArtCaption: 'People. Light. Feeling.',
      heroImageAlt: 'A sunlit celebration, shown as temporary portfolio imagery',
      servicesEyebrow: 'What we photograph',
      servicesTitle: 'A place for your story.',
      servicesLead: 'Thoughtful photography for the moments and people you want to remember.',
      galleryEyebrow: 'Recent stories',
      galleryLead: 'Explore the galleries we have chosen to share. Private galleries open only through their own link.',
      contactCalloutTitle: 'Let’s talk about your plans.',
      footerTagline: 'Photography with feeling.',
      aboutPage: {
        title: 'Meet Giulia',
        body: "I'm Giulia, an Italian girl who moved to Canada with a passion for family photography. I've always been the one grabbing the camera to capture happy moments — with a keen eye for aesthetics and, above all, making people feel at ease in front of the lens.",
      },
    } },
    fr: { gallery: {
      heroEyebrow: 'Des images pour les moments qui comptent',
      heroTitle: 'Votre histoire, avec attention.',
      heroLead: 'Atelier Giulia porte un regard sensible sur les célébrations, les portraits et les personnes que vous aimez. Découvrez notre univers et racontez-nous votre projet.',
      heroArtCaption: 'Présence. Lumière. Émotion.',
      heroImageAlt: 'Une célébration ensoleillée, présentée avec une image provisoire du portfolio',
      servicesEyebrow: 'Ce que nous photographions',
      servicesTitle: 'Une place pour votre histoire.',
      servicesLead: 'Des images attentives aux moments et aux personnes dont vous voulez vous souvenir.',
      galleryEyebrow: 'Histoires récentes',
      galleryLead: 'Découvrez les galeries que nous avons choisi de partager. Les galeries privées sont accessibles uniquement par leur lien.',
      contactCalloutTitle: 'Parlons de votre projet.',
      footerTagline: 'Des images pleines de vie.',
      aboutPage: {
        title: 'Rencontrez Giulia',
        body: 'Je suis Giulia, une Italienne installée au Canada et passionnée par la photographie de famille. J’ai toujours été celle qui saisit l’appareil pour garder les moments heureux, avec un œil sensible à l’esthétique et surtout l’envie de mettre chacun à l’aise devant l’objectif.',
      },
    } },
  },
} as const satisfies SiteDefinition;

export default atelierGiuliaSite;
