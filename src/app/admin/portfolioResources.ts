export const portfolioResources = {
  en: { admin: { portfolio: {
    title: 'Portfolio', description: 'Add permanent selected photos and organize them by service. These images are separate from client galleries.',
    loading: 'Loading portfolio…', error: 'The portfolio change could not be saved. Check the photo and try again.',
    service: 'Service category', altFr: 'Photo description in French', altEn: 'Photo description in English',
    order: 'Display order within the service', photo: 'Portfolio photo', upload: 'Retry photo upload',
    uploadHint: 'Choose the same original photo to resume an interrupted upload. To use a different photo, remove this entry and add a new one.',
    add: 'Add photo', photos: 'Portfolio photos', empty: 'No portfolio photos yet.', pending: 'Upload incomplete', published: 'Published',
    save: 'Save details', saved: 'Details saved.', remove: 'Remove photo', cancel: 'Cancel',
    removeTitle: 'Remove this portfolio photo?', removeBody: 'The photo disappears from the public portfolio immediately. Stored variants are removed in the background.',
  } } },
  fr: { admin: { portfolio: {
    title: 'Portfolio', description: 'Ajoutez des photos choisies pour le portfolio permanent et classez-les par service. Elles sont distinctes des galeries clients.',
    loading: 'Chargement du portfolio…', error: 'Impossible d’enregistrer le changement au portfolio. Vérifiez la photo et réessayez.',
    service: 'Catégorie de service', altFr: 'Description de la photo en français', altEn: 'Description de la photo en anglais',
    order: 'Ordre d’affichage dans le service', photo: 'Photo du portfolio', upload: 'Reprendre le téléversement',
    uploadHint: 'Choisissez la même photo originale pour reprendre un envoi interrompu. Pour utiliser une autre photo, retirez cette entrée et créez-en une nouvelle.',
    add: 'Ajouter la photo', photos: 'Photos du portfolio', empty: 'Aucune photo dans le portfolio.', pending: 'Téléversement incomplet', published: 'Publiée',
    save: 'Enregistrer les détails', saved: 'Détails enregistrés.', remove: 'Retirer la photo', cancel: 'Annuler',
    removeTitle: 'Retirer cette photo du portfolio?', removeBody: 'La photo disparaît aussitôt du portfolio public. Les variantes stockées sont supprimées en arrière-plan.',
  } } },
} as const;
