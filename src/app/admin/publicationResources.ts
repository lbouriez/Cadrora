import type { i18n } from 'i18next';

export const publicationResources = {
  en: { publication: {
    availability: 'Visitor availability', cancel: 'Cancel', close: 'Close confirmation',
    confirmOffline: 'Take gallery offline',
    description: 'Control whether visitors can discover or open this gallery. Photos and AI data remain safely stored when it is offline.',
    error: 'Gallery availability could not be updated. Please try again.', indexing: 'Facial indexing in progress',
    offlineBody: 'Every public and guest link will stop working, active guest access will be revoked, and face search will be unavailable. Photos, variants, and AI data stay stored so you can republish without importing again.',
    offlineTitle: 'Take this gallery offline?', photosSent: 'Photos uploaded', publish: 'Publish gallery',
    readOnly: 'Try each availability option. The final Worker action remains disabled in the read-only demo.',
    republish: 'Republish gallery', saveAvailability: 'Update availability', saving: 'Updating…',
    state: { draft: 'Draft', offline: 'Offline', published: 'Published', unlisted: 'Unlisted' },
    takeOffline: 'Take gallery offline',
    target: { offline: 'Offline — unavailable to everyone', published: 'Public — listed on the website', unlisted: 'Unlisted — direct link only' },
    targetHint: {
      offline: 'Direct links, protected access, media requests, and AI search will stop working.',
      published: 'The gallery appears on the public website and works at its direct link.',
      unlisted: 'The gallery stays off public lists but works for anyone with its direct link and required password.',
    },
    title: 'Gallery availability', variantsReady: 'Image variants ready',
  } },
  fr: { publication: {
    availability: 'Disponibilité pour les visiteurs', cancel: 'Annuler', close: 'Fermer la confirmation',
    confirmOffline: 'Mettre la galerie hors ligne',
    description: 'Contrôlez si les visiteurs peuvent découvrir ou ouvrir cette galerie. Les photos et données IA restent conservées lorsqu’elle est hors ligne.',
    error: 'La disponibilité de la galerie n’a pas pu être modifiée. Réessayez.', indexing: 'Indexation faciale en cours',
    offlineBody: 'Tous les liens publics et invités cesseront de fonctionner, les accès invités actifs seront révoqués et la recherche faciale sera indisponible. Les photos, variantes et données IA restent conservées pour permettre une republication sans nouvel import.',
    offlineTitle: 'Mettre cette galerie hors ligne ?', photosSent: 'Photos envoyées', publish: 'Publier la galerie',
    readOnly: 'Essayez chaque option de disponibilité. L’action finale du Worker reste désactivée dans la démo en lecture seule.',
    republish: 'Republier la galerie', saveAvailability: 'Modifier la disponibilité', saving: 'Modification…',
    state: { draft: 'Brouillon', offline: 'Hors ligne', published: 'Publiée', unlisted: 'Non répertoriée' },
    takeOffline: 'Mettre la galerie hors ligne',
    target: { offline: 'Hors ligne — inaccessible à tous', published: 'Publique — affichée sur le site', unlisted: 'Non répertoriée — lien direct uniquement' },
    targetHint: {
      offline: 'Les liens directs, accès protégés, médias et recherches IA cesseront de fonctionner.',
      published: 'La galerie apparaît sur le site public et fonctionne avec son lien direct.',
      unlisted: 'La galerie reste absente des listes publiques mais fonctionne par lien direct, avec mot de passe si nécessaire.',
    },
    title: 'Disponibilité de la galerie', variantsReady: 'Variantes prêtes',
  } },
} as const;

export function installPublicationResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', publicationResources.en, true, false);
  instance.addResourceBundle('fr', 'translation', publicationResources.fr, true, false);
}
