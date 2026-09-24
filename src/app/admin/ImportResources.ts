/** Merge this resource fragment into the root i18next resources during PA integration. */
export const adminImportResources = {
  en: {
    translation: {
      adminImport: {
        cancel: 'Cancel import',
        corruptFile: 'We could not open this file, so it was skipped.',
        dropzoneDescription: 'JPEG, PNG, or WebP. Private details, such as location, are removed before your photos are sent.',
        dropzoneOriginalDescription: 'JPEG, PNG, or WebP. Original files are also saved so visitors can download them.',
        dropzoneLabel: 'Drop photos here or choose files',
        encoding: 'Getting your photos ready…',
        eta: 'About {{seconds}} seconds remaining',
        failed: 'The import paused. You can resume it after checking your connection.',
        pause: 'Pause import',
        paused: 'Import paused',
        progress: 'Import progress',
        quota: 'This gallery cannot accept all these photos. Add fewer photos or check your limits.',
        resume: 'Resume import',
        start: 'Start import',
        unsupportedFile: 'Only JPEG, PNG, and WebP files can be imported.',
        originalTooLarge: 'This original is larger than 100 MB. Export a smaller file before importing it.',
      },
    },
  },
  fr: {
    translation: {
      adminImport: {
        cancel: "Annuler l'importation",
        corruptFile: 'Nous n’avons pas pu ouvrir ce fichier. Il a été ignoré.',
        dropzoneDescription: 'JPEG, PNG ou WebP. Les données privées, comme la localisation, sont retirées avant l’envoi des photos.',
        dropzoneOriginalDescription: 'JPEG, PNG ou WebP. Les fichiers originaux sont aussi conservés pour le téléchargement.',
        dropzoneLabel: 'Déposez des photos ici ou choisissez des fichiers',
        encoding: 'Préparation de vos photos…',
        eta: 'Environ {{seconds}} secondes restantes',
        failed: "L'importation est en pause. Vous pouvez la reprendre après avoir vérifié votre connexion.",
        pause: "Mettre l'importation en pause",
        paused: 'Importation en pause',
        progress: "Progression de l'importation",
        quota: 'Cette galerie ne peut pas accueillir toutes ces photos. Ajoutez-en moins ou vérifiez vos limites.',
        resume: "Reprendre l'importation",
        start: "Démarrer l'importation",
        unsupportedFile: 'Seuls les fichiers JPEG, PNG et WebP peuvent être importés.',
        originalTooLarge: 'Cet original dépasse 100 Mo. Exportez un fichier plus petit avant de l’importer.',
      },
    },
  },
} as const;
