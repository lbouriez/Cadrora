export const serviceEditorResources = {
  en: { admin: { serviceEditor: {
    loading: 'Loading sessions…', error: 'The session could not be saved. Check the translations, photo, and connection, then try again.',
    saved: 'Session saved.', newService: 'New session', hidden: 'Hidden', enabled: 'Show on the Sessions page',
    showOnHome: 'Include on Home', photo: 'Session photo', photoRequired: 'Upload a photo before showing this new session.',
    title: 'Title', shortDescription: 'Short Home description', description: 'Sessions page description', point: 'Included detail {{number}}',
    duration: 'Session duration (optional)', priceRange: 'Price or price range (optional)', details: 'More information for the session dialog (optional)',
    save: 'Save session', create: 'Create session', add: 'Add a session',
    homeSummary: '{{count}} sessions selected for Home.',
    onHome: 'On Home', moveUp: 'Move {{name}} up', moveDown: 'Move {{name}} down',
  } } },
  fr: { admin: { serviceEditor: {
    loading: 'Chargement des séances…', error: 'La séance n’a pas pu être enregistrée. Vérifiez les traductions, la photo et la connexion, puis réessayez.',
    saved: 'Séance enregistrée.', newService: 'Nouvelle séance', hidden: 'Masqué', enabled: 'Afficher sur la page Séances',
    showOnHome: 'Inclure sur l’accueil', photo: 'Photo de la séance', photoRequired: 'Téléversez une photo avant d’afficher cette nouvelle séance.',
    title: 'Titre', shortDescription: 'Courte description pour l’accueil', description: 'Description sur la page Séances', point: 'Élément inclus {{number}}',
    duration: 'Durée de la séance (facultatif)', priceRange: 'Prix ou fourchette tarifaire (facultatif)', details: 'Informations pour la fenêtre de la séance (facultatif)',
    save: 'Enregistrer la séance', create: 'Créer la séance', add: 'Ajouter une séance',
    homeSummary: '{{count}} séances sélectionnées pour l’accueil.',
    onHome: 'Sur l’accueil', moveUp: 'Monter {{name}}', moveDown: 'Descendre {{name}}',
  } } },
} as const;
