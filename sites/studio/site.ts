import type { SiteDefinition } from '../../src/app/site/types';
import profile from './profile.json';

/** Neutral starting profile for a new independent photographer deployment. */
export const studioSite = {
  id: profile.id,
  name: profile.name,
  seoOrigin: null,
  shareImageUrl: '/home-hero-image/large',
  seoLocales: null,
  seoPages: null,
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
    family: '/brand/service-family.webp',
    brand: '/brand/service-brand.webp',
    corporate: '/brand/service-corporate.webp',
    children: '/brand/service-children.webp',
    maternity: '/brand/service-maternity.webp',
    portrait: '/brand/service-portrait.webp',
    couples: '/brand/service-couples.webp',
  },
  home: {
    presentation: 'editorial',
    primaryAction: { href: '/contact', labelKey: 'gallery.contactCalloutAction', shortLabelKey: 'gallery.contactCalloutAction' },
    secondaryAction: { href: '#services', labelKey: 'gallery.studioSessionsAction', shortLabelKey: 'gallery.studioSessionsAction' },
    sections: ['services', 'approach', 'contact'],
    showProof: false,
  },
  demo: null,
  copy: {
    fr: { gallery: {
      heroEyebrow: 'Portraits, liens et instants de vie',
      heroTitle: 'Ce qui compte mérite une image.',
      heroLead: 'Prendre le temps. Trouver la lumière. Garder une trace des personnes et des moments qui vous ressemblent.',
      heroArtCaption: 'Un regard, une rencontre, un souvenir.',
      studioSessionsAction: 'Découvrir les séances',
      servicesEyebrow: 'Les séances', servicesTitle: 'Une place pour votre histoire.',
      servicesLead: 'Un portrait, des moments en famille, un projet à raconter. Découvrez les séances et imaginons ensemble la vôtre.',
      approachEyebrow: 'L’approche', approachTitle: 'Des images simples. Des souvenirs qui restent.',
      approachBody: 'Une séance commence par une conversation : vos envies, votre rythme et ce que vous souhaitez garder. Les photos trouvent ensuite leur place dans une galerie à partager avec les personnes de votre choix.',
      footerTagline: 'Des photographies faites pour durer.',
      contactTitle: 'Parlons de votre prochaine séance.',
      contactBody: 'Présentez votre projet, vos envies et la période qui vous conviendrait. Nous pourrons préparer la suite ensemble.',
      aboutPage: { title: 'Une photographie à votre image.', body: 'Ce qui fait une belle image commence bien avant le déclenchement : une rencontre, de l’écoute et la liberté d’être soi.' },
    } },
    en: { gallery: {
      heroEyebrow: 'Portraits, connections and everyday moments',
      heroTitle: 'What matters deserves a photograph.',
      heroLead: 'Take your time. Find the light. Keep something of the people and moments that feel like you.',
      heroArtCaption: 'A glance, a connection, a memory.',
      studioSessionsAction: 'Explore the sessions',
      servicesEyebrow: 'The sessions', servicesTitle: 'Room for your story.',
      servicesLead: 'A portrait, time with family, a project to share. Explore the sessions and let’s imagine yours together.',
      approachEyebrow: 'The approach', approachTitle: 'Simple images. Lasting memories.',
      approachBody: 'A session starts with a conversation: what you have in mind, your pace and what you want to remember. Your photographs then come together in a gallery to share with the people you choose.',
      footerTagline: 'Photographs made to be remembered.',
      contactTitle: 'Let’s talk about your next session.',
      contactBody: 'Tell us about your project, what you have in mind and the dates that would suit you. We can plan the next steps together.',
      aboutPage: { title: 'Photography that feels like you.', body: 'A meaningful photograph starts before the shutter: a connection, a listening ear and the freedom to be yourself.' },
    } },
  },
} as const satisfies SiteDefinition;

export default studioSite;
