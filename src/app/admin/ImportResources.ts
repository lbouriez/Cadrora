/** Merge this resource fragment into the root i18next resources during PA integration. */
export const adminImportResources = {
  en: {
    translation: {
      adminImport: {
        cancel: 'Cancel import',
        corruptFile: 'This file could not be decoded and was skipped.',
        dropzoneDescription: 'JPEG, PNG, or WebP. Metadata is removed before upload.',
        dropzoneLabel: 'Drop photos here or choose files',
        encoding: 'Preparing secure image variants…',
        eta: 'About {{seconds}} seconds remaining',
        failed: 'The import paused. You can resume it after checking your connection.',
        pause: 'Pause import',
        paused: 'Import paused',
        progress: 'Import progress',
        quota: 'This import exceeds the available event quota.',
        resume: 'Resume import',
        start: 'Start import',
        unsupportedFile: 'Only JPEG, PNG, and WebP files can be imported.',
      },
    },
  },
  fr: {
    translation: {
      adminImport: {
        cancel: "Annuler l'importation",
        corruptFile: "Ce fichier ne peut pas être décodé et a été ignoré.",
        dropzoneDescription: 'JPEG, PNG ou WebP. Les métadonnées sont supprimées avant le téléversement.',
        dropzoneLabel: 'Déposez des photos ici ou choisissez des fichiers',
        encoding: 'Préparation de variantes sécurisées…',
        eta: 'Environ {{seconds}} secondes restantes',
        failed: "L'importation est en pause. Vous pouvez la reprendre après avoir vérifié votre connexion.",
        pause: "Mettre l'importation en pause",
        paused: 'Importation en pause',
        progress: "Progression de l'importation",
        quota: "Cette importation dépasse le quota disponible pour l'événement.",
        resume: "Reprendre l'importation",
        start: "Démarrer l'importation",
        unsupportedFile: 'Seuls les fichiers JPEG, PNG et WebP peuvent être importés.',
      },
    },
  },
} as const;
