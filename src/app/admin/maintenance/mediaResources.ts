export const mediaResources = {
  en: { admin: { diagnostics: {
    mediaTitle: 'Media inventory', mediaDescription: 'Scan 100 R2 objects per request. Objects uploaded less than 15 minutes ago are ignored. A missing D1 row needs manual review; this screen never deletes objects.',
    scope: { galleries: 'Scan galleries', services: 'Scan sessions', portfolio: 'Scan portfolio' },
    scanning: 'Scanning media…', scanError: 'Could not scan media.', noUntracked: 'No untracked objects in scanned pages.',
    scanStatus: 'Scanned {{count}} objects. Cleanup jobs: {{pending}} pending, {{running}} running, {{failed}} failed.',
    objectKey: 'R2 object key', uploaded: 'Uploaded', scanNext: 'Scan next 100',
  } } },
  fr: { admin: { diagnostics: {
    mediaTitle: 'Inventaire des médias', mediaDescription: 'Analyse de 100 objets R2 par requête. Les objets téléversés depuis moins de 15 minutes sont ignorés. Une absence dans D1 exige une vérification manuelle; cette page ne supprime rien.',
    scope: { galleries: 'Analyser les galeries', services: 'Analyser les séances', portfolio: 'Analyser le portfolio' },
    scanning: 'Analyse des médias…', scanError: 'Impossible d’analyser les médias.', noUntracked: 'Aucun objet sans référence dans les pages analysées.',
    scanStatus: '{{count}} objets analysés. Tâches de nettoyage : {{pending}} en attente, {{running}} en cours, {{failed}} en échec.',
    objectKey: 'Clé de l’objet R2', uploaded: 'Téléversé', scanNext: 'Analyser les 100 suivants',
  } } },
} as const;
