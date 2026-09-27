export const serviceEditorResources = {
  en: { admin: { serviceEditor: {
    loading: 'Loading services…', error: 'The service could not be saved. Check the translations, photo, and connection, then try again.',
    saved: 'Service saved.', newService: 'New service', hidden: 'Hidden', enabled: 'Show on the Services page',
    showOnHome: 'Include on Home', photo: 'Service photo', photoRequired: 'Upload a photo before showing this new service.',
    title: 'Title', shortDescription: 'Short Home description', description: 'Services page description', point: 'Detail {{number}}',
    save: 'Save service', create: 'Create service', resetCopy: 'Restore default text', add: 'Add a service',
    homeSummary: '{{selected}} services selected for Home; the first {{shown}} appear with the current limit of {{limit}}.',
    onHome: 'On Home', beyondLimit: 'Beyond Home limit', moveUp: 'Move {{name}} up', moveDown: 'Move {{name}} down',
  } } },
  fr: { admin: { serviceEditor: {
    loading: 'Chargement des services…', error: 'Le service n’a pas pu être enregistré. Vérifiez les traductions, la photo et la connexion, puis réessayez.',
    saved: 'Service enregistré.', newService: 'Nouveau service', hidden: 'Masqué', enabled: 'Afficher sur la page Services',
    showOnHome: 'Inclure sur l’accueil', photo: 'Photo du service', photoRequired: 'Téléversez une photo avant d’afficher ce nouveau service.',
    title: 'Titre', shortDescription: 'Courte description pour l’accueil', description: 'Description sur la page Services', point: 'Détail {{number}}',
    save: 'Enregistrer le service', create: 'Créer le service', resetCopy: 'Rétablir le texte par défaut', add: 'Ajouter un service',
    homeSummary: '{{selected}} services sélectionnés pour l’accueil; les {{shown}} premiers apparaissent avec la limite actuelle de {{limit}}.',
    onHome: 'Sur l’accueil', beyondLimit: 'Au-delà de la limite', moveUp: 'Monter {{name}}', moveDown: 'Descendre {{name}}',
  } } },
} as const;
