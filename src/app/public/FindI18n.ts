import type { i18n } from 'i18next';

export const findResources = {
  en: { faceFind: {
    eyebrow: 'Private photo search', startTitle: 'Start with a photo',
    title: 'Find possible photos of you',
    open: 'Find my possible photos',
    privacy: 'Choose a clear photo of your face. The photo stays on your device; only a mathematical signature is used to look for possible matches in this gallery.',
    consent: 'I agree to process my photo on this device and send its mathematical face signature to search this gallery.',
    selfie: 'Take a selfie', choose: 'Choose a photo', analyze: 'Find faces', loadingModels: 'Preparing private on-device search…',
    cameraUnavailable: 'Camera capture is not available in this browser. Choose a photo instead.', cameraAccess: 'Allow camera access, then frame your face.',
    capture: 'Use this photo', cancelCamera: 'Cancel camera', cameraFailed: 'We could not access the camera. Choose a photo instead.',
    detectedFaces: 'Detected faces', oneFaceFound: 'One face found', oneFaceHelp: 'Your face is selected and ready to search.',
    facesFound: '{{count}} faces found', chooseFace: 'Select the face to use directly on the photo.', faceNumber: 'Face {{number}}', selectedFace: 'Face {{number}} selected', search: 'Search this gallery',
    possibleMatches: 'Possible matches', possibleHelp: 'These are visual similarities, not confirmed identities.',
    resultCount: '{{count}} possible photos found in this gallery.', seeAll: 'See all found photos', openMatch: 'Open photo',
    previousResult: 'Previous found photos', nextResult: 'More found photos',
    nearby: 'Photos from nearby moments', nearbyFound: '{{count}} additional nearby photos found automatically.', loadingNearby: 'Looking for nearby moments…',
    previousNearby: 'Previous nearby photos', nextNearby: 'More nearby photos', openNearby: 'Open nearby photo', nearbyAlt: 'Photo from a nearby event moment',
    more: 'Search more partitions', noFaces: 'No clear face was found. Try another well-lit photo.',
    noMatches: 'No possible matches were found.', unavailable: 'Face search is unavailable. The gallery remains available.',
    back: 'Back to gallery', imageAlt: 'Locally selected search photo', matchAlt: 'Possible matching event photo',
    testPortraits: 'Want to try the demo?', testPortraitsHelp: 'Save one of these fictional portraits, then choose it above to see matching demo photos.',
    testPortraitAmelia: 'Save Amelia’s portrait', testPortraitDaniel: 'Save Daniel’s portrait',
  } },
  fr: { faceFind: {
    eyebrow: 'Recherche photo privée', startTitle: 'Commencez avec une photo',
    title: 'Trouver des photos possibles de vous',
    open: 'Trouver mes photos possibles',
    privacy: 'Choisissez une photo nette de votre visage. Elle reste sur votre appareil; seule une signature mathématique sert à chercher des correspondances possibles dans cette galerie.',
    consent: "J’accepte de traiter ma photo sur cet appareil et d’envoyer sa signature mathématique du visage pour chercher dans cette galerie.",
    selfie: 'Prendre un égoportrait', choose: 'Choisir une photo', analyze: 'Trouver les visages', loadingModels: 'Préparation de la recherche privée sur cet appareil…',
    cameraUnavailable: 'La capture par caméra n’est pas offerte dans ce navigateur. Choisissez plutôt une photo.', cameraAccess: 'Autorisez la caméra, puis cadrez votre visage.',
    capture: 'Utiliser cette photo', cancelCamera: 'Annuler la caméra', cameraFailed: 'Impossible d’accéder à la caméra. Choisissez plutôt une photo.',
    detectedFaces: 'Visages détectés', oneFaceFound: 'Un visage trouvé', oneFaceHelp: 'Votre visage est sélectionné et prêt pour la recherche.',
    facesFound: '{{count}} visages trouvés', chooseFace: 'Sélectionnez directement sur la photo le visage à utiliser.', faceNumber: 'Visage {{number}}', selectedFace: 'Visage {{number}} sélectionné', search: 'Rechercher dans cette galerie',
    possibleMatches: 'Correspondances possibles', possibleHelp: "Il s'agit de ressemblances visuelles, et non d'identités confirmées.",
    resultCount: '{{count}} photos possibles trouvées dans cette galerie.', seeAll: 'Voir toutes les photos trouvées', openMatch: 'Ouvrir la photo',
    previousResult: 'Photos trouvées précédentes', nextResult: 'Plus de photos trouvées',
    nearby: 'Photos de moments rapprochés', nearbyFound: '{{count}} photos rapprochées supplémentaires trouvées automatiquement.', loadingNearby: 'Recherche des moments rapprochés…',
    previousNearby: 'Photos rapprochées précédentes', nextNearby: 'Plus de photos rapprochées', openNearby: 'Ouvrir la photo rapprochée', nearbyAlt: "Photo d'un moment rapproché de l'événement",
    more: "Rechercher dans d'autres partitions", noFaces: "Aucun visage net n'a été trouvé. Essayez une autre photo bien éclairée.",
    noMatches: "Aucune correspondance possible n'a été trouvée.", unavailable: 'La recherche faciale est indisponible. La galerie demeure accessible.',
    back: 'Retour à la galerie', imageAlt: 'Photo de recherche choisie localement', matchAlt: "Photo d'événement possiblement correspondante",
    testPortraits: 'Envie d’essayer la démo?', testPortraitsHelp: 'Enregistrez un de ces portraits fictifs, puis choisissez-le ci-dessus pour voir ses photos de démonstration.',
    testPortraitAmelia: 'Enregistrer le portrait d’Amelia', testPortraitDaniel: 'Enregistrer le portrait de Daniel',
  } },
} as const;

export function installFindResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', findResources.en, true, true);
  instance.addResourceBundle('fr', 'translation', findResources.fr, true, true);
}
