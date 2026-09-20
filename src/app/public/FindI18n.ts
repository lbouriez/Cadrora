import type { i18n } from 'i18next';

export const findResources = {
  en: { faceFind: {
    title: 'Find possible photos of you',
    open: 'Find my possible photos',
    privacy: 'Your selfie or chosen photo stays on this device. Only a numeric face representation is sent for this event search.',
    consent: 'I understand and agree to process this photo on my device for this search.',
    selfie: 'Take a selfie', choose: 'Choose a photo', analyze: 'Find faces', loadingModels: 'Preparing private on-device search…',
    chooseFace: 'Choose the face to search for', faceNumber: 'Face {{number}}', search: 'Search this event',
    possibleMatches: 'Possible matches', possibleHelp: 'These are visual similarities, not confirmed identities.',
    nearby: 'Photos from a nearby moment', more: 'Search more partitions', noFaces: 'No clear face was found. Try another well-lit photo.',
    noMatches: 'No possible matches were found.', unavailable: 'Face search is unavailable. The gallery remains available.',
    back: 'Back to gallery', imageAlt: 'Locally selected search photo', matchAlt: 'Possible matching event photo',
  } },
  fr: { faceFind: {
    title: 'Trouver des photos possibles de vous',
    open: 'Trouver mes photos possibles',
    privacy: "Votre égoportrait ou photo choisie reste sur cet appareil. Seule une représentation numérique du visage est transmise pour la recherche dans cet événement.",
    consent: "Je comprends et j'accepte le traitement de cette photo sur mon appareil pour cette recherche.",
    selfie: 'Prendre un égoportrait', choose: 'Choisir une photo', analyze: 'Trouver les visages', loadingModels: 'Préparation de la recherche privée sur cet appareil…',
    chooseFace: 'Choisissez le visage à rechercher', faceNumber: 'Visage {{number}}', search: 'Rechercher dans cet événement',
    possibleMatches: 'Correspondances possibles', possibleHelp: "Il s'agit de ressemblances visuelles, et non d'identités confirmées.",
    nearby: "Photos d'un moment rapproché", more: "Rechercher dans d'autres partitions", noFaces: "Aucun visage net n'a été trouvé. Essayez une autre photo bien éclairée.",
    noMatches: "Aucune correspondance possible n'a été trouvée.", unavailable: 'La recherche faciale est indisponible. La galerie demeure accessible.',
    back: 'Retour à la galerie', imageAlt: 'Photo de recherche choisie localement', matchAlt: "Photo d'événement possiblement correspondante",
  } },
} as const;

export function installFindResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', findResources.en, true, true);
  instance.addResourceBundle('fr', 'translation', findResources.fr, true, true);
}
