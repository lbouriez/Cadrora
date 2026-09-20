import type { i18n } from 'i18next';

export const publicationResources = {
  en: {
    publication: {
      error: 'Publication could not be completed. Please try again.',
      galleryPublished: 'Gallery published',
      indexing: 'Facial indexing in progress',
      photosSent: 'Photos uploaded',
      notPublished: 'Not yet',
      publish: 'Publish gallery',
      published: 'Yes',
      publishing: 'Publishing…',
      title: 'Publication readiness',
      variantsReady: 'Image variants ready',
    },
  },
  fr: {
    publication: {
      error: "La publication n'a pas pu être terminée. Réessayez.",
      galleryPublished: 'Galerie publiée',
      indexing: "Indexation faciale en cours",
      photosSent: 'Photos envoyées',
      notPublished: 'Pas encore',
      publish: 'Publier la galerie',
      published: 'Oui',
      publishing: 'Publication…',
      title: 'État de publication',
      variantsReady: 'Variantes prêtes',
    },
  },
} as const;

export function installPublicationResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', publicationResources.en, true, false);
  instance.addResourceBundle('fr', 'translation', publicationResources.fr, true, false);
}
