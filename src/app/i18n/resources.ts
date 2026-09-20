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
        faceIndexBusy: 'This photo is being indexed or deleted. Please try again shortly.',
        internal: 'An unexpected error occurred.',
        rateLimited: 'Too many requests. Please try again shortly.',
        routeNotFound: 'This API route does not exist.',
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
        faceIndexBusy: "Cette photo est en cours d’indexation ou de suppression. Réessayez dans un instant.",
        internal: 'Une erreur inattendue est survenue.',
        rateLimited: 'Trop de requêtes. Réessayez dans un instant.',
        routeNotFound: "Cette route d'API n'existe pas.",
      },
      security: {
        challengeLoading: 'Préparation de la vérification de sécurité…',
        challengeUnavailable: 'La vérification de sécurité est indisponible. Actualisez la page et réessayez.',
      },
    },
  },
} as const;
