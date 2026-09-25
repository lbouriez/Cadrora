import type { i18n } from 'i18next';

export const publicationResources = {
  en: { publication: {
    availability: 'Visitor availability', cancel: 'Cancel', close: 'Close confirmation',
    confirmOffline: 'Take gallery offline',
    description: 'Choose who can open this gallery. Taking it offline hides it without deleting your photos or face-search data.',
    error: 'Gallery availability could not be updated. Please try again.', gallerySettings: 'Gallery settings', indexing: 'Preparing photo search',
    offlineBody: 'Visitors will lose access to this gallery, including through links they already have. Face search will stop too. Your photos and search data stay saved, so you can bring the gallery back later.',
    offlineTitle: 'Take this gallery offline?', photosSent: 'Photos uploaded', publish: 'Publish gallery',
    readOnly: 'Explore the availability options. Changes cannot be saved in this demo.',
    republish: 'Republish gallery', saveAvailability: 'Update availability', saving: 'Updating…',
    state: { draft: 'Draft', offline: 'Offline', published: 'Published', unlisted: 'Unlisted' },
    takeOffline: 'Take gallery offline',
    target: { offline: 'Offline — unavailable to everyone', published: 'Public — listed on the website', unlisted: 'Unlisted — direct link only' },
    targetHint: {
      offline: 'Visitors cannot open the gallery or use its photo search, even with a link or password.',
      published: 'The gallery appears on the public website and works at its direct link.',
      unlisted: 'The gallery stays off public lists but works for anyone with its direct link and required password.',
    },
    title: 'Gallery availability', variantsReady: 'Photos ready',
  } },
  fr: { publication: {
    availability: 'Disponibilité pour les visiteurs', cancel: 'Annuler', close: 'Fermer la confirmation',
    confirmOffline: 'Mettre la galerie hors ligne',
    description: 'Choisissez qui peut ouvrir cette galerie. La mettre hors ligne la masque sans supprimer vos photos ni les données de recherche faciale.',
    error: 'La disponibilité de la galerie n’a pas pu être modifiée. Réessayez.', gallerySettings: 'Réglages de la galerie', indexing: 'Préparation de la recherche de photos',
    offlineBody: 'Les visiteurs perdront l’accès à cette galerie, même s’ils ont déjà son lien. La recherche faciale s’arrêtera aussi. Vos photos et les données de recherche restent enregistrées pour que vous puissiez remettre la galerie en ligne plus tard.',
    offlineTitle: 'Mettre cette galerie hors ligne ?', photosSent: 'Photos envoyées', publish: 'Publier la galerie',
    readOnly: 'Explorez les options de disponibilité. Les changements ne peuvent pas être enregistrés dans cette démo.',
    republish: 'Republier la galerie', saveAvailability: 'Modifier la disponibilité', saving: 'Modification…',
    state: { draft: 'Brouillon', offline: 'Hors ligne', published: 'Publiée', unlisted: 'Non répertoriée' },
    takeOffline: 'Mettre la galerie hors ligne',
    target: { offline: 'Hors ligne — inaccessible à tous', published: 'Publique — affichée sur le site', unlisted: 'Non répertoriée — lien direct uniquement' },
    targetHint: {
      offline: 'Les visiteurs ne peuvent plus ouvrir la galerie ni chercher leurs photos, même avec un lien ou un mot de passe.',
      published: 'La galerie apparaît sur le site public et fonctionne avec son lien direct.',
      unlisted: 'La galerie reste absente des listes publiques mais fonctionne par lien direct, avec mot de passe si nécessaire.',
    },
    title: 'Disponibilité de la galerie', variantsReady: 'Photos prêtes',
  } },
} as const;

export function installPublicationResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', publicationResources.en, true, false);
  instance.addResourceBundle('fr', 'translation', publicationResources.fr, true, false);
}
