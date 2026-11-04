# Votre site / Your website

Ce dossier est votre point de départ. Il partage les composants, les galeries et
l'administration de Cadrora ; il ne contient aucune clé privée.

## Personnaliser / Customize

- **Administration → Réglages du site** : nom, coordonnées, textes FR/EN, photos,
  séances, tarifs et visibilité des pages. Ces valeurs restent prioritaires lors
  des prochaines publications. / These saved settings survive deployments.
- **`profile.json`** : identité et langue par défaut, description et icône.
- **`site.ts`** : textes de départ FR/EN, composition de l'accueil et choix des
  photos fournies. / Bilingual fallback copy and shared page composition.
- **`theme.css`** : couleurs et typographie à travers les tokens sémantiques.
- **`initial-settings.sql`** : initialisation des valeurs encore vierges ; ne pas
  remplacer ce fichier par une remise à zéro des réglages du propriétaire.

Les images fournies sont des illustrations de départ : remplacez-les par vos
propres photos avant de partager votre site. Aucun contact, tarif, témoignage ou
lieu d'activité n'est inventé. / Replace the starter photos with your own work.

Enregistrez vos modifications puis poussez-les sur la branche choisie pendant
l'installation : l'action **Publication des sites** vérifie et publie le site.
Les changements effectués dans l'administration sont enregistrés directement,
sans commit Git. / Admin changes do not need a Git push.

La configuration publique de publication se trouve dans `.cadrora/deployments/`.
Les clés sont dans l'environnement GitHub de cette installation : jamais ici.
