# Cadrora — plan de refonte ciblée

Proposition du 2 novembre 2026, fondée sur [l’audit](01-audit.md) et [le système de design](02-design-system.md). Les textes ci-dessous sont des propositions FR/EN, pas des contenus publiés ni des déclarations de résultats.

## Objectif et périmètre

Rendre trois choses évidentes : ce que le photographe obtient, comment l’essayer et ce qu’implique l’installation. Conserver la démonstration de site photographe, ses pages et toutes les fonctions de galerie. L’accueil porte l’explication du logiciel ; les pages intérieures restent des exemples contextualisés.

La refonte concerne principalement **PB** et les primitives partagées. Les opérations **PA** d’administration, **PC** d’import, **PD** de publication/médias et **PE** de recherche restent intactes. Une éventuelle amélioration de l’essai IA sera un lot PB/PE explicite et séparé. Cette phase ne demande ni abonnement, paiement, rendez-vous en ligne, CRM, nouveau fournisseur de formulaire ou architecture multi-tenant.

Les recommandations d’architecture restent compatibles avec [ADR-052](../decisions/ADR-052-showcase-copy-authority.md). Elles ne réactivent pas les grands projets différés dans [review-follow-ups.md](../review-follow-ups.md), notamment le wizard d’installation, le workflow complet d’approbation client et les pages de séances partageables.

## Plan du site et navigation

| Entrée maintenue | URL existante | Ajustement recommandé |
| --- | --- | --- |
| Accueil | /, /fr/, /en/ | Promesse, essais, résultat concret, installation et questions fréquentes |
| Séances | /services ; /fr/services ; /en/services | Démontrer les offres d’un studio et leurs détails ; contexte « exemple » visible |
| Portfolio | /portfolio et collections | Faire voir rapidement les photos et la structure de collections |
| Galeries | /galleries | Séparer clairement exemple public/protégé, sans modifier l’accès |
| À propos | /about et variantes | Démontrer une présentation de studio avec un titre lisible |
| Contact | /contact et variantes | Démontrer les coordonnées directes, sans formulaire ni promesse de réservation réelle |
| Confidentialité | /privacy et variantes | Informations et choix, accessibles depuis toutes les pages |
| Galerie, photo, recherche | /e/:slug, /e/:slug/photo/:photoId, /e/:slug/find | Fonctionnement existant ; hors navigation marketing principale |
| Administration | /admin/* ; entrée de démo existante | Démo explicitement en lecture seule ; administration réelle authentifiée |

Les variantes localisées suivent le mécanisme actuel de canonical/hreflang ; aucun changement d’URL n’est nécessaire. Les liens optionnels continuent de dépendre des réglages. Le logo reste le retour à l’accueil. Ajouter un lien d’évitement vers le contenu principal dans PublicLayout.

Sur Home, une petite ligne de repères **« Démonstrations · Installation »** peut compléter le hero avec les ancres existantes #demo et #installation. Ce sont des raccourcis dans la page, pas un remplacement de la navigation par « Produit/Tarifs ». Sur les pages d’exemple, un repère discret près de l’introduction peut indiquer « Exemple de site créé avec Cadrora » et proposer un retour à l’explication sur l’accueil.

Sur mobile, garder le menu actuel à six entrées, les commandes de langue et de thème ainsi que les cibles de 44 px. Réduire le décor du header avant de retirer des commandes. Un nom Cadrora compact près du logo vaut mieux qu’un nouveau slogan dans la barre ; à 320 px, les commandes prioritaires doivent toujours tenir sans collision.

## Nouvelle composition de l’accueil

Ordre actuel : hero → démonstrations → installation → huit séances → approche → galeries → site réel.

Ordre proposé :

| Ordre | Bloc et rôle | Contenu / action | Réutilisation et contrainte |
| --- | --- | --- | --- |
| 1 | Hero : comprendre et commencer | Proposition courte, deux actions, preuve visuelle du produit, trois repères factuels | HomePage et actions existantes ; image gérée par ProgressivePhoto |
| 2 | Démonstrations : essayer | IA vedette, galerie publique, galerie protégée, admin en lecture seule ; différencier invité/propriétaire | DemoExperienceCards ; garder l’entrée IA /e/find-your-photos/find et tous les essais |
| 3 | Parcours : relier les fonctions | Présenter son travail → partager une galerie → recueillir les choix autorisés | Recomposer la section approach avec trois points courts ; aucune nouvelle fonction supposée |
| 4 | Exemple réel : établir la crédibilité | Atelier Giulia, description factuelle et lien du site | FeaturedSites, remonté ; titre au singulier tant qu’un seul site est montré |
| 5 | Exemple de site : voir la souplesse | Petit aperçu de séances puis liens vers catalogue et portfolio | Cartes existantes ; cible de trois exemples dans le showcase, à confirmer éditorialement |
| 6 | Galeries : poursuivre l’exploration | Aperçu court et lien vers toutes les galeries visibles | PublicEventCards et réglages actuels ; pas de révélation de contenu protégé |
| 7 | Installation : décider en connaissance de cause | Prérequis, trois étapes, logiciel sans abonnement, coûts d’hébergement variables ; guide direct | Section stack/#installation existante, enrichie sans wizard |
| 8 | Questions et conclusion | 4–6 réponses factuelles ; reprendre « Voir le guide d’installation » et « Revenir aux démos » | Nouvelle section de composition typée si nécessaire ; aucune API supplémentaire |

L’ancre #installation permet toujours un accès direct depuis le hero même si la section se situe plus bas. Tester la proximité de la preuve réelle avec la démo plutôt que d’affirmer que cet ordre convertira mieux. Garder toutes les pages et tous les exemples accessibles, même lorsqu’un aperçu d’accueil devient plus court.

Le choix de trois séances est une **recommandation éditoriale propre au showcase**, pas une nouvelle limite générale du catalogue. Ne pas supprimer des cartes D1 ni réécrire les choix Home du propriétaire. Si nécessaire, introduire une option de composition de profil, avec comportement historique par défaut et tests d’Atelier.

### Composition indicative du hero

| Ordinateur | Téléphone |
| --- | --- |
| Colonne gauche : repère photographe, titre, deux phrases, actions, preuves | Repère + titre court ; description condensée ; action primaire et secondaire sans collision |
| Colonne droite : véritable aperçu de galerie ou du site avec photographie | Aperçu produit qui commence avant une longue liste de détails ; aucune hauteur d’écran imposée |
| Une légende indique la démonstration | Les détails d’hébergement restent disponibles juste après le premier bloc |

Le visuel doit montrer ce que le logiciel permet. Une capture de la véritable interface de galerie avec une photo est plus informative qu’une simple photo de mariage. Garder une photographie expressive et éviter une maquette fictive de navigateur qui promet des fonctionnalités absentes. Le CTA reste du texte HTML cliquable, hors de l’image.

## Stratégie de conversion

~~~mermaid
flowchart LR
  A[Accueil : comprendre Cadrora] --> B[Essayer les démonstrations]
  B --> C[Galerie publique ou protégée]
  B --> D[Recherche facultative avec consentement]
  B --> E[Administration en lecture seule]
  A --> F[Comprendre l’installation]
  C --> F
  E --> F
  F --> G[Guide existant : prérequis et étapes]
  A --> H[Pages d’exemple du photographe]
  H --> I[Contact d’exemple clairement identifié]
~~~

Les flèches vers l’installation désignent un parcours à faciliter depuis les surfaces marketing ; elles ne justifient pas d’insérer une publicité produit dans chaque galerie cliente ou dans l’administration d’un studio.

**Action primaire du hero :** « Essayer la démo », vers #demo. La démonstration permet d’évaluer sans créer de compte. **Action secondaire :** « Voir l’installation », vers #installation. La seconde action n’annonce plus qu’un site sera créé immédiatement.

Dans #demo, conserver l’IA vedette prévue par le guide public, mais la galerie sans recherche reste une alternative évidente. Conserver la prudence « photos où vous apparaissez peut-être ». Expliquer au moment utile que la photo reste locale et qu’une empreinte est envoyée pour la recherche dans cette galerie ; ne pas étendre cette promesse à « aucune donnée ne quitte l’appareil ».

Dans #installation, une seule action principale ouvre la section de lancement du guide existant. Des liens secondaires permettent de lire licence, maintenance et limites. Ne pas présenter les coûts techniques comme un abonnement Cadrora ni promettre une installation instantanée. Le contact fictif n’est pas un canal de support produit ; les ressources documentaires doivent être nommées comme telles.

Sur les vraies installations de photographes, conserver le parcours Séance → détails → Contact avec le paramètre session. Les liens tel/mailto restent directs. Ni formulaire ni réservation automatisée n’est nécessaire pour satisfaire cet objectif.

## Propositions de textes FR / EN

Les textes doivent rejoindre les ressources bilingues du profil. Le hero et certaines copies peuvent être surchargés par D1 : une modification de fichier ne garantit pas le remplacement d’un contenu enregistré. Prévoir une mise à jour éditoriale ciblée, avec respect des modifications du propriétaire ; ne pas appliquer une migration globale de texte.

| Emplacement | Français proposé | Anglais proposé |
| --- | --- | --- |
| Surtitre hero | Un site et des galeries pour photographes | A website and galleries for photographers |
| Titre hero | Votre photographie. Votre site. Vos galeries. | Your photography. Your website. Your galleries. |
| Description hero | Présentez votre travail et partagez vos photos avec vos clients. Installez Cadrora dans votre propre compte Cloudflare, puis adaptez-le à votre studio. | Present your work and share photos with your clients. Install Cadrora in your own Cloudflare account, then make it your studio’s own. |
| Actions hero | Essayer la démo · Voir l’installation | Try the demo · Explore setup |
| Repères factuels | Galeries protégées · Sans abonnement au logiciel · Votre propre hébergement | Protected galleries · No software subscription · Your own hosting |
| Aide installation proche de l’action | L’installation initiale demande quelques connaissances techniques. | Initial setup requires some technical knowledge. |
| Titre démonstrations | Découvrez le site côté invité et côté photographe. | Explore the guest and photographer experience. |
| Démo admin | Explorez l’administration en lecture seule. Les modifications sont désactivées dans cette démo. | Explore the read-only admin. Changes are disabled in this demo. |
| Carte site réel | Un site créé avec Cadrora. | A website built with Cadrora. |
| Repère page intérieure | Exemple de site photographe — explorez le résultat. | Example photography website — explore the result. |
| CTA Contact dans le showcase | Voir la page Contact d’exemple | View the sample Contact page |
| Titre installation | Ce qu’il faut pour lancer votre site. | What you need to launch your website. |
| Étapes installation | Préparer vos comptes · Installer Cadrora · Ajouter votre contenu et tester une galerie | Prepare your accounts · Install Cadrora · Add your content and test a gallery |
| Note de coût | Le logiciel est sans abonnement. Le domaine, l’hébergement et les services facultatifs peuvent entraîner des frais. | The software has no subscription. Your domain, hosting and optional services may incur charges. |
| Conclusion | Prêt à explorer l’installation ? | Ready to explore setup? |
| Action finale | Voir le guide d’installation | Read the setup guide |

FAQ proposée : « Est-ce un service hébergé ? », « Quelles connaissances faut-il pour commencer ? », « Le logiciel et l’hébergement sont-ils gratuits ? », « Que peut-on modifier depuis l’administration ? », « Les invités doivent-ils utiliser la recherche faciale ? », « Comment mettre le site à jour ? ». Réponses courtes avec liens vers les guides existants ; aucune durée, capacité, économie ou assistance garantie sans preuve.

## Recommandations par page

| Page | Garder | Améliorer | Ne pas ajouter implicitement |
| --- | --- | --- | --- |
| Home | Essais utilisables, hébergement propre, images fictives annoncées | Hero plus compact, preuves plus hautes, aperçu de séances court, installation plus concrète | Nouvelle offre SaaS, inscription ou paiement |
| Séances | Photos, modal de détails, tarifs structurés, inclusions et contexte Contact | Réduire l’intro, donner un contexte « exemple » aux étapes et CTA ; aligner les cartes sans hauteur de texte fixe | Tarifs au premier plan partout : le contrat les réserve aux détails ; nouvelles pages partageables |
| Portfolio | Collections et catégories indépendantes des services, visionneuse | Afficher les premières photos plus tôt ; titres courts et descriptions utiles ; fin de collection claire | Galerie cliente transformée en portfolio sans publication explicite |
| Galeries | Accès direct, pagination, cartes privées génériques | Libellés « public/protégé » simples ; retirer le mot de passe de la carte d’annuaire du seed, le conserver au déverrouillage | Indexation des galeries clients ou miniature privée avant autorisation |
| À propos | Photo et texte propriétaire, variante de profil | Corriger le titre FR sur bureau ; taille adaptée à la colonne ; action showcase cohérente | Faux récit de photographe, fausse ancienneté ou avis |
| Contact | Téléphone/courriel directs, absence de formulaire, carte au clic | Mention fictive près des coordonnées, langage d’exemple cohérent jusque dans la zone de service | Canal de support inexistant, délai de réponse ou disponibilité inventés |
| Confidentialité | Sommaire, explications du selfie/empreinte et choix | Lisibilité et liens de retour, panneau proportionné | Simplification qui ferait croire que l’empreinte reste locale |
| Galerie/visionneuse | Photos, clavier, cœurs et retouches distincts, droits de téléchargement | Contrastes, noms d’action utiles, états de chargement/erreur | Nouveau panier, validation finale de sélection ou promesse de reprise non implémentée |
| Recherche | Choix facultatif et consentement explicite | Instructions d’essai plus faciles ; possible sélection directe d’un portrait d’exemple dans un lot séparé | Recherche intergaleries, identité certaine, téléchargement de selfie |
| Admin | Fonctionnalités et sécurité actuelles | Bénéficier des primitives corrigées ; annoncer clairement la lecture seule | Refonte de workflows propriétaire non auditée |

## Pied de page

Conserver identité, mention de démonstration, Confidentialité, Gérer mes choix, Démo admin et Contact. Ajouter, pour le showcase seulement, des liens nommés vers le guide d’installation et la licence du dépôt. Garder un footer court à deux groupes : **Explorer la démo** et **Installer Cadrora** ; sur téléphone, lecture verticale sans blocs surdimensionnés. Les vraies installations continuent d’utiliser leurs coordonnées, leur identité et le crédit existant.

## Architecture UI, performance et SEO

- Réordonner les sections par la configuration de profil avant d’envisager une page de remplacement. Réutiliser FeaturedSites, DemoExperienceCards et les cartes existantes.
- La FAQ et les repères de démonstration peuvent nécessiter une extension typée de composition. La prévoir avec comportement neutre pour les autres profils et sans nouvelle API.
- Corriger les couples de couleurs dans tokens/components et la cascade de public.css. Toute correction partagée appelle une validation d’Atelier et du profil standard.
- Maintenir ProgressivePhoto, les tailles réservées et les variantes locales. Mesurer les octets et requêtes réellement chargés avant d’ajouter une capture produit. Un visuel supplémentaire ne doit pas doubler le poids du hero sans bénéfice établi.
- Mesurer sur chargement froid puis chaud, réseau ralenti et API retardée. Étudier l’accès précoce au texte sans exposer de source d’image avant résolution des paramètres. Les délais existants de 15/30 secondes sont des garde-fous, pas des objectifs de performance.
- Garder HTML marketing statique, canonical/hreflang/OG/Twitter, statut 404 réel, sitemap des pages permises et exclusions des galeries. Mettre à jour titres/descriptions avec la copie effective du profil, puis vérifier HTML initial et DOM hydraté.
- Ne pas ajouter de données structurées Review, AggregateRating, LocalBusiness ou Offer fondées sur les personnes, tarifs et coordonnées fictifs de la démonstration.
- Ne pas installer de nouvelle bibliothèque de composants, animation, suivi ou formulaire. Si un besoin ultérieur exige une dépendance, un ADR dans la même modification reste obligatoire.

## Vérifier les hypothèses de conversion

Commencer par un petit groupe de photographes et de personnes qui les aident techniquement. Leur demander, après une courte exposition : que fait Cadrora, où est-il hébergé, comment l’essayer, peut-on réserver une séance ici et quelle est la prochaine étape ? Observer les hésitations, puis faire trouver une galerie, les prérequis et le guide. Cela produit des observations qualitatives, pas un taux de conversion de production.

Si une mesure est ensuite activée par le propriétaire, limiter les événements à l’intention sur les surfaces marketing : clic Essayer la démo, choix d’un type de démo, clic vers le guide, clic vers le site réel. Employer des noms et paramètres énumérés, sans identifiant de galerie, photo, personne, URL privée ou texte libre. Les clics vers une galerie mesurent une intention ; ils ne prouvent ni ouverture réussie ni installation terminée. Ne pas élargir les routes GA aux galeries pour compléter artificiellement un funnel.

Comparer avant/après sur périodes comparables seulement si le trafic et le consentement donnent assez de données. Aucun objectif chiffré de gain n’est fixé sans baseline. La clarté du parcours et la correction des défauts observés sont les premiers critères de réussite.
