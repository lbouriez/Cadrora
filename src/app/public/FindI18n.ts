import type { i18n } from 'i18next';

export const findResources = {
  en: { faceFind: {
    title: 'Find possible photos of you',
    open: 'Find my possible photos',
    privacy: 'Your selfie or chosen photo stays on this device. Only a numeric face representation is sent for this event search.',
    consent: 'I understand and agree to process this photo on my device for this search.',
    selfie: 'Take a selfie', choose: 'Choose a photo', analyze: 'Find faces', loadingModels: 'Preparing private on-device search…',
    cameraUnavailable: 'Camera capture is not available in this browser. Choose a photo instead.', cameraAccess: 'Allow camera access, then frame your face.',
    capture: 'Use this photo', cancelCamera: 'Cancel camera', cameraFailed: 'We could not access the camera. Choose a photo instead.',
    detectedFaces: 'Detected faces', oneFaceFound: 'One face found', oneFaceHelp: 'Your face is selected and ready to search.',
    facesFound: '{{count}} faces found', chooseFace: 'Select the face to use directly on the photo.', faceNumber: 'Face {{number}}', selectedFace: 'Face {{number}} selected', search: 'Search this event',
    possibleMatches: 'Possible matches', possibleHelp: 'These are visual similarities, not confirmed identities.',
    resultCount: '{{count}} possible photos found in this gallery.', seeAll: 'See all found photos', openMatch: 'Open photo',
    previousResult: 'Previous found photos', nextResult: 'More found photos',
    nearby: 'Photos from nearby moments', nearbyFound: '{{count}} additional nearby photos found automatically.', loadingNearby: 'Looking for nearby moments…',
    previousNearby: 'Previous nearby photos', nextNearby: 'More nearby photos', openNearby: 'Open nearby photo', nearbyAlt: 'Photo from a nearby event moment',
    more: 'Search more partitions', noFaces: 'No clear face was found. Try another well-lit photo.',
    noMatches: 'No possible matches were found.', unavailable: 'Face search is unavailable. The gallery remains available.',
    back: 'Back to gallery', imageAlt: 'Locally selected search photo', matchAlt: 'Possible matching event photo',
    testPortraits: 'Fictional test portraits', testPortraitsHelp: 'Download one of these fictional guests, then select it with “Choose a photo”.',
    testPortraitAmelia: 'Download Amelia’s test portrait', testPortraitDaniel: 'Download Daniel’s test portrait',
  } },
  fr: { faceFind: {
    title: 'Trouver des photos possibles de vous',
    open: 'Trouver mes photos possibles',
    privacy: "Votre égoportrait ou photo choisie reste sur cet appareil. Seule une représentation numérique du visage est transmise pour la recherche dans cet événement.",
    consent: "Je comprends et j'accepte le traitement de cette photo sur mon appareil pour cette recherche.",
    selfie: 'Prendre un égoportrait', choose: 'Choisir une photo', analyze: 'Trouver les visages', loadingModels: 'Préparation de la recherche privée sur cet appareil…',
    cameraUnavailable: 'La capture par caméra n’est pas offerte dans ce navigateur. Choisissez plutôt une photo.', cameraAccess: 'Autorisez la caméra, puis cadrez votre visage.',
    capture: 'Utiliser cette photo', cancelCamera: 'Annuler la caméra', cameraFailed: 'Impossible d’accéder à la caméra. Choisissez plutôt une photo.',
    detectedFaces: 'Visages détectés', oneFaceFound: 'Un visage trouvé', oneFaceHelp: 'Votre visage est sélectionné et prêt pour la recherche.',
    facesFound: '{{count}} visages trouvés', chooseFace: 'Sélectionnez directement sur la photo le visage à utiliser.', faceNumber: 'Visage {{number}}', selectedFace: 'Visage {{number}} sélectionné', search: 'Rechercher dans cet événement',
    possibleMatches: 'Correspondances possibles', possibleHelp: "Il s'agit de ressemblances visuelles, et non d'identités confirmées.",
    resultCount: '{{count}} photos possibles trouvées dans cette galerie.', seeAll: 'Voir toutes les photos trouvées', openMatch: 'Ouvrir la photo',
    previousResult: 'Photos trouvées précédentes', nextResult: 'Plus de photos trouvées',
    nearby: 'Photos de moments rapprochés', nearbyFound: '{{count}} photos rapprochées supplémentaires trouvées automatiquement.', loadingNearby: 'Recherche des moments rapprochés…',
    previousNearby: 'Photos rapprochées précédentes', nextNearby: 'Plus de photos rapprochées', openNearby: 'Ouvrir la photo rapprochée', nearbyAlt: "Photo d'un moment rapproché de l'événement",
    more: "Rechercher dans d'autres partitions", noFaces: "Aucun visage net n'a été trouvé. Essayez une autre photo bien éclairée.",
    noMatches: "Aucune correspondance possible n'a été trouvée.", unavailable: 'La recherche faciale est indisponible. La galerie demeure accessible.',
    back: 'Retour à la galerie', imageAlt: 'Photo de recherche choisie localement', matchAlt: "Photo d'événement possiblement correspondante",
    testPortraits: 'Portraits de test fictifs', testPortraitsHelp: 'Téléchargez l’un de ces invités fictifs, puis choisissez-le avec « Choisir une photo ».',
    testPortraitAmelia: 'Télécharger le portrait de test d’Amelia', testPortraitDaniel: 'Télécharger le portrait de test de Daniel',
  } },
} as const;

export function installFindResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', findResources.en, true, true);
  instance.addResourceBundle('fr', 'translation', findResources.fr, true, true);
}
