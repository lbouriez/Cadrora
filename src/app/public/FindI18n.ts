import type { i18n } from 'i18next';

export const findResources = {
  en: { faceFind: {
    eyebrow: 'Private photo search', startTitle: 'Start with a photo',
    title: 'Find photos you may be in',
    open: 'Find photos of me',
    privacy: 'Choose a clear photo of your face. Your photo stays on your device. To search this gallery, Cadrora sends a face pattern made from it, not the photo itself.',
    consent: 'I agree to have my photo checked on this device and to send a face pattern from it to search this gallery.',
    selfie: 'Take a selfie', choose: 'Choose a photo', analyze: 'Find a face in this photo', loadingModels: 'Getting photo search ready…',
    cameraUnavailable: 'Camera capture is not available in this browser. Choose a photo instead.', cameraAccess: 'Allow camera access, then frame your face.',
    capture: 'Use this photo', cancelCamera: 'Cancel camera', cameraFailed: 'We could not access the camera. Choose a photo instead.',
    detectedFaces: 'Faces found in your photo', oneFaceFound: 'One face found', oneFaceHelp: 'This face is selected. You can search the gallery now.',
    facesFound: '{{count}} faces found', chooseFace: 'Select the face to use directly on the photo.', faceNumber: 'Face {{number}}', selectedFace: 'Face {{number}} selected', search: 'Search this gallery',
    possibleMatches: 'Photos you may be in', possibleHelp: 'These photos look similar to the face you chose. Please check them yourself.',
    resultCount_one: '{{count}} possible photo found in this gallery.', resultCount_other: '{{count}} possible photos found in this gallery.', seeAll: 'See all possible photos', openMatch: 'Open photo',
    previousResult: 'Previous found photos', nextResult: 'More found photos',
    nearby: 'Photos taken around the same time', nearbyFound_one: '{{count}} more photo was taken around the same time. It is not a face match.', nearbyFound_other: '{{count}} more photos were taken around the same time. They are not face matches.', loadingNearby: 'Looking for photos taken around the same time…',
    previousNearby: 'Previous nearby photos', nextNearby: 'More nearby photos', openNearby: 'Open nearby photo', nearbyAlt: 'Photo from a nearby event moment',
    more: 'Look through more photos', noFaces: 'We could not find a clear face. Try a brighter photo with your face looking at the camera.',
    noMatches: 'We could not find a possible match in this gallery. You can still browse all its photos.', unavailable: 'Photo search is unavailable right now. You can still browse the gallery.',
    back: 'Back to gallery', imageAlt: 'Locally selected search photo', matchAlt: 'Possible matching event photo',
    testPortraits: 'Want to try it?', testPortraitsHelp: 'Save one of these sample portraits, then choose it above to look for matching photos in the demo gallery.',
    testPortraitAmelia: 'Save Amelia’s portrait', testPortraitDaniel: 'Save Daniel’s portrait',
  } },
  fr: { faceFind: {
    eyebrow: 'Recherche photo privée', startTitle: 'Commencez avec une photo',
    title: 'Retrouvez les photos où vous apparaissez peut-être',
    open: 'Retrouver mes photos',
    privacy: 'Choisissez une photo nette de votre visage. Elle reste sur votre appareil. Pour chercher dans cette galerie, Cadrora envoie une empreinte créée à partir du visage, pas la photo elle-même.',
    consent: 'J’accepte que ma photo soit examinée sur cet appareil et qu’une empreinte de mon visage soit envoyée pour chercher dans cette galerie.',
    selfie: 'Prendre un égoportrait', choose: 'Choisir une photo', analyze: 'Trouver un visage sur cette photo', loadingModels: 'Préparation de la recherche de photos…',
    cameraUnavailable: 'La capture par caméra n’est pas offerte dans ce navigateur. Choisissez plutôt une photo.', cameraAccess: 'Autorisez la caméra, puis cadrez votre visage.',
    capture: 'Utiliser cette photo', cancelCamera: 'Annuler la caméra', cameraFailed: 'Impossible d’accéder à la caméra. Choisissez plutôt une photo.',
    detectedFaces: 'Visages trouvés sur votre photo', oneFaceFound: 'Un visage trouvé', oneFaceHelp: 'Ce visage est sélectionné. Vous pouvez maintenant chercher dans la galerie.',
    facesFound: '{{count}} visages trouvés', chooseFace: 'Sélectionnez directement sur la photo le visage à utiliser.', faceNumber: 'Visage {{number}}', selectedFace: 'Visage {{number}} sélectionné', search: 'Rechercher dans cette galerie',
    possibleMatches: 'Photos où vous apparaissez peut-être', possibleHelp: 'Ces photos ressemblent au visage choisi. Vérifiez-les vous-même.',
    resultCount_one: '{{count}} photo possible trouvée dans cette galerie.', resultCount_other: '{{count}} photos possibles trouvées dans cette galerie.', seeAll: 'Voir toutes les photos possibles', openMatch: 'Ouvrir la photo',
    previousResult: 'Photos trouvées précédentes', nextResult: 'Plus de photos trouvées',
    nearby: 'Photos prises autour du même moment', nearbyFound_one: '{{count}} autre photo a été prise à peu près au même moment. Ce n’est pas une correspondance faciale.', nearbyFound_other: '{{count}} autres photos ont été prises à peu près au même moment. Ce ne sont pas des correspondances faciales.', loadingNearby: 'Recherche de photos prises autour du même moment…',
    previousNearby: 'Photos rapprochées précédentes', nextNearby: 'Plus de photos rapprochées', openNearby: 'Ouvrir la photo rapprochée', nearbyAlt: "Photo d'un moment rapproché de l'événement",
    more: 'Parcourir plus de photos', noFaces: 'Nous n’avons pas trouvé de visage net. Essayez une photo plus lumineuse, le visage tourné vers l’appareil.',
    noMatches: 'Nous n’avons pas trouvé de ressemblance dans cette galerie. Vous pouvez quand même parcourir toutes ses photos.', unavailable: 'La recherche de photos est indisponible pour le moment. Vous pouvez quand même parcourir la galerie.',
    back: 'Retour à la galerie', imageAlt: 'Photo de recherche choisie localement', matchAlt: "Photo d'événement possiblement correspondante",
    testPortraits: 'Envie d’essayer?', testPortraitsHelp: 'Enregistrez un de ces portraits d’exemple, puis choisissez-le ci-dessus pour chercher ses photos dans la galerie de démonstration.',
    testPortraitAmelia: 'Enregistrer le portrait d’Amelia', testPortraitDaniel: 'Enregistrer le portrait de Daniel',
  } },
} as const;

export function installFindResources(instance: i18n): void {
  instance.addResourceBundle('en', 'translation', findResources.en, true, true);
  instance.addResourceBundle('fr', 'translation', findResources.fr, true, true);
}
