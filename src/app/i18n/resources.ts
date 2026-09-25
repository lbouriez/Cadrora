export const resources = {
  en: {
    translation: {
      app: {
        brandAlt: 'Cadrora logo',
        eyebrow: 'Event photo gallery',
        foundationReady: 'The private gallery is getting ready.',
        title: 'Cadrora',
      },
      common: {
        close: 'Close',
      },
      errors: {
        photoDuplicateConflict: 'This photo is already in the gallery.',
        demoReadOnly: 'This demonstration account is read-only.',
        faceIndexBusy: 'This photo is still being prepared or removed. Please try again shortly.',
        internal: 'An unexpected error occurred.',
        rateLimited: 'Too many requests. Please try again shortly.',
        routeNotFound: 'We could not find what you requested.',
      },
      security: {
        challengeLoading: 'Preparing the security check…',
        challengeUnavailable: 'The security check is unavailable. Refresh the page and try again.',
      },
    },
  },
  fr: {
    translation: {
      app: {
        brandAlt: 'Logo Cadrora',
        eyebrow: 'Galerie photo événementielle',
        foundationReady: 'La galerie privée se prépare.',
        title: 'Cadrora',
      },
      common: {
        close: 'Fermer',
      },
      errors: {
        photoDuplicateConflict: 'Cette photo est déjà dans la galerie.',
        demoReadOnly: 'Ce compte de démonstration est en lecture seule.',
        faceIndexBusy: 'Cette photo est encore en préparation ou en cours de suppression. Réessayez dans un instant.',
        internal: 'Une erreur inattendue est survenue.',
        rateLimited: 'Trop de requêtes. Réessayez dans un instant.',
        routeNotFound: 'Nous n’avons pas trouvé ce que vous cherchez.',
      },
      security: {
        challengeLoading: 'Préparation de la vérification de sécurité…',
        challengeUnavailable: 'La vérification de sécurité est indisponible. Actualisez la page et réessayez.',
      },
    },
  },
} as const;
