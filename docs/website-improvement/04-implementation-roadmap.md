# Cadrora — feuille de route d’implémentation

Date : 2 novembre 2026. **Plan proposé, non exécuté.** L’audit, le système visuel et le plan de refonte sont documentaires. Cette feuille de route ne vaut pas autorisation de publier ni de modifier les contrats gelés.

Liens : [audit et preuves](01-audit.md) · [système visuel](02-design-system.md) · [plan de refonte](03-redesign-blueprint.md).

## Ordre recommandé

**P0 : restaurer une lecture fiable → P1 : clarifier le parcours → P2 : approfondir la qualité → P3 : tester les extensions facultatives.** Pas de reconstruction générale, pas de dépendance ajoutée par défaut. La priorité la plus élevée signifie « à traiter avant les autres améliorations de cette refonte », pas « incident de sécurité ou panne globale ».

Complexité indicative : **S** = modification concentrée avec revue ciblée ; **M** = plusieurs composants/états ou interaction avec paramètres et profils ; **L** = parcours transversal, architecture ou validation appareils significative. Ce ne sont pas des engagements de durée. La préparation des contenus et la validation par le propriétaire peuvent dépasser le temps de code.

Responsabilités : **PB** = public/galeries ; **PA** = administration ; **PC** = préparation/import ; **PD** = médias/publication ; **PE** = recherche faciale ; **socle UI** = composants, styles et i18n partagés. Voir le [plan d’implémentation de référence](../implementation-plan.md).

## P0 — Lisibilité et accès à l’action

| Lot | Pages / fichiers concernés | Dépendances et complexité | Critères d’acceptation vérifiables |
| --- | --- | --- | --- |
| P0.1 — Panneau de confidentialité proportionné (A01) | Toutes pages publiques ; PrivacyConsent.tsx, public.css. PB/socle UI | **M** ; comprendre le comportement en attente des paramètres avant de changer la hauteur | À 390 × 844, sans Analytics, plus de bloc vide de 29rem ; texte et choix visibles, CTA du hero accessible sans obstruction persistante. Tester paramètres lents, succès, erreur, Analytics disponible/absent, première visite et réouverture. Aucun chargement GA avant accord ; choix enregistrés et révocables. FR/EN, clair/sombre, 320 px et texte agrandi restent utilisables. |
| P0.2 — Contrastes cohérents (A02, A03) | Boutons et carte Démo admin ; tokens.css, components.css, public.css. Socle UI/PB, contrôle PA | **S–M** ; palette du document 02 ; coordination avec Atelier pour les styles partagés | Paragraphe admin et libellés primaires ≥4,5:1 dans les deux thèmes, y compris survol. Aucun texte de bouton sur une portion trop claire du dégradé. Focus lisible et cibles ≥44 px. Captures de la même carte avant/après et vérification des principaux boutons publics/admin. |
| P0.3 — Titre À propos contenu dans sa colonne (A04) | AboutPage et styles de titre/intro. PB/socle UI | **S** ; conserver la variante immersive d’Atelier | À 1440 × 1000, le mot « présentation » ne touche plus la photo ; aucune coupure à 1024, 390 et 320 px, FR/EN, 200 % de zoom et titre long propriétaire. Vérifier les boîtes de texte, pas seulement scrollWidth. CTA et contenu restent accessibles sans hauteur figée. |

Livrer ces corrections en lot restreint avant les changements de composition. Elles n’exigent ni migration ni remplacement de composant. Si un correctif touche un token partagé, vérifier tous ses usages significatifs, notamment les surfaces inversées et les actions de l’administration.

## P1 — Parcours, contenu et identité

| Lot | Pages / fichiers concernés | Dépendances et complexité | Critères d’acceptation vérifiables |
| --- | --- | --- | --- |
| P1.1 — Contexte des pages d’exemple (A05, A12) | Profil Cadrora, AboutPage, ShowcasePages, SessionDetailsModal, Contact ; copie de seed privée si nécessaire. PB ; PD seulement pour seed ciblé | **M** ; P0 ; ADR-052 ; revoir provenance D1/repository des textes | Les CTA showcase vers Contact annoncent une page d’exemple ; aucune promesse de réservation réelle. Tous les liens conservent leur destination et le paramètre session. Les studios réels gardent leur langage commercial. Mot de passe de démo retiré de la carte d’annuaire seulement, toujours présent à l’endroit prévu pour déverrouiller. Seed limité à l’identité Cadrora et aux anciennes valeurs connues, idempotent, préservant les éditions ultérieures. |
| P1.2 — Hero compact et preuve produit (A08, A09) | HomePage, profil/site.ts, profil/theme.css, assets locaux via BrandPhoto. PB/socle UI | **M** ; P0.2 ; capture réelle à produire et vérifier ; aucune nouvelle police | Premier écran mobile présente la promesse et l’action principale ; un visuel concret arrive avant une longue suite de badges. Aucune perte d’information à 320 px/zoom. Nom/contrôles du header sans collision. Hero et capture ne téléchargent pas de sources provisoires avant réglages. FR/EN et deux thèmes revus. Comparaison du poids initial avant/après documentée. |
| P1.3 — Ordre et densité de Home (A07, A11) | sites/cadrora/site.ts, HomePage, FeaturedSites, DemoExperienceCards. PB | **M** ; P1.1–P1.2 ; option de profil typée si aperçu de séances réduit | Démo → parcours → site réel apparaissent avant le catalogue long. Atelier Giulia reste un lien factuel avec titre singulier. Toutes les séances restent accessibles sur la page dédiée. Aucun réglage showOnHome/enabled du propriétaire n’est réécrit pour obtenir la nouvelle composition. Autres profils inchangés dans leur sélection de contenu. |
| P1.4 — Installation compréhensible (A06, A15) | #installation, copie FR/EN, footer showcase, guide existant. PB/documentation | **S–M** ; P1.3 ; vérifier les destinations exactes et la copie de prérequis | « Voir l’installation » atteint #installation ; le lien de guide atteint réellement le guide, pas seulement la racine du dépôt. Trois étapes lisibles, compétences initiales et frais possibles explicités. FAQ fondée sur les guides. Aucun tarif fournisseur non vérifié, délai de mise en ligne garanti ou promesse de service hébergé. |
| P1.5 — Navigation clavier et actions (A13) | PublicLayout, PublicPageIntro, noms accessibles des cartes/visionneuse. PB/socle UI | **M** ; P0.2 ; garder la navigation actuelle et les routes | Lien d’évitement visible au focus et menant au main ; ordre de tabulation cohérent. Menu ouvre/ferme, Échap restaure le focus. Modale conserve le focus et le rend à son déclencheur. Actions image décrivent leur but, sans perdre le nom de fichier utile. Vérification lecteur d’écran ciblée consignée, pas seulement inspection DOM. |

Le repositionnement du hero et des textes de démonstration reste limité au profil showcase. D1 peut posséder une copie personnalisée : comparer les valeurs avant de décider d’une mise à jour ciblée. Ne pas ajouter une migration qui écrase tous les propriétaires.

## P2 — Cohérence, performance et mesure

| Lot | Pages / fichiers concernés | Dépendances et complexité | Critères d’acceptation vérifiables |
| --- | --- | --- | --- |
| P2.1 — Harmonisation éditoriale des pages (A08, A09, A15) | PublicPageIntro, cartes de Séances/Portfolio/Galeries, Contact/Privacy, styles. PB/socle UI | **M** ; P1 ; conserver ProgressivePhoto et les composants partagés | Premières cartes/photos plus proches du titre sans supprimer le contexte. Même hiérarchie de titres et mêmes espacements. Tarifs toujours dans les détails de séance ; variantes zéro/un/plusieurs tarifs validées. Champs optionnels vides omis. En cas de carte/map indisponible, Contact reste utile. |
| P2.2 — Rendu initial et chargement des images (A14) | HomePage, FirstFrameReveal, ProgressivePhoto, initialPublicRequests, CSS. PB/socle UI ; PC/PD uniquement si une recette média change explicitement | **L** ; baseline froide/chaude et lente avant modification ; respecter l’autorité D1 | Mesures avant/après reproductibles avec viewport, réseau et cache enregistrés. Navigation/texte utiles pendant l’attente si la conception le permet ; aucune requête d’image compilée avant résolution d’un override. Cadres réservés sans déplacement visible. Erreurs de toutes sources, requêtes retardées et reprises conservent un chemin de sortie. Aucun gain CWV revendiqué sans mesure réelle. |
| P2.3 — Métadonnées cohérentes avec la nouvelle copie (A15) | profile.json, génération HTML, PublicLayout ; contrôle searchIndex. PB/build | **M** ; textes P1 finalisés ; aucun changement d’URL prévu | Titres/descriptions FR/EN cohérents entre HTML initial et hydratation ; canonical/hreflang réciproques ; OG/Twitter contrôlés. URL inconnue toujours 404 noindex. Pages désactivées absentes de la découverte selon leurs contrats. Aucune galerie cliente ajoutée au sitemap ; aucune note/identité fictive en JSON-LD. |
| P2.4 — Tests de compréhension et mesure facultative (A16) | Copie Home et plan de mesure ; GoogleAnalytics seulement si activation demandée. PB | **M** ; P1 ; consentement/propriétaire et volume de trafic disponibles | Restituer observations qualitatives sur produit, installation, démo et Contact fictif. Si suivi activé, événements marketing à valeurs énumérées sans données de galerie/personne. Refus/révocation bloque l’émission. Un clic vers guide n’est pas compté comme installation réussie. Baseline et limites documentées. Aucune activation de GA par défaut. |
| P2.5 — Finition du système et réduction des règles concurrentes (A02, A09) | public.css, tokens.css, components.css, composants existants. Socle UI/PB | **M** ; stabilisation P0/P1 ; inventorier les usages avant suppression | Regrouper les règles concurrentes réellement identifiées sans refonte CSS globale. Valeurs réutilisables dans tokens ; aucune palette locale ; aucune duplication Button/Card/Photo. Réduction du mouvement respectant prefers-reduced-motion ; captures stables de toutes les pages touchées. |

Les mesures de performance doivent suivre les parcours réellement importants. Ne pas installer un tracker ou supprimer une barrière de confidentialité pour obtenir un meilleur résultat de laboratoire. Tout nouveau budget chiffré doit être présenté comme un objectif proposé et comparé à une baseline, pas comme l’état actuel.

## P3 — Expérimentations et extensions conditionnelles

| Lot | Pages / composants concernés | Dépendances et complexité | Critères d’acceptation avant adoption |
| --- | --- | --- | --- |
| P3.1 — Essai avec portrait d’exemple sans manipulation de fichier (A10) | FindPage et parcours démo uniquement. PB/PE | **L** ; P1 ; revue de consentement et source locale ; appareils réels | Un exemple ne déclenche ni caméra ni recherche avant accord. Utiliser un portrait de démo connu, jamais une image client. Même traitement local et empreinte limitée à la galerie ; messages de correspondance possible maintenus. Annulation, modèle indisponible, faible mémoire et refus de consentement revus. Aucun selfie téléversé. |
| P3.2 — Cas d’usage réel enrichi (A11) | FeaturedSites et page Home. PB/contenu | **M** ; accord sur captures et propos, provenance vérifiable | Cas Atelier Giulia factuel et daté, lien correct, contenu autorisé. Témoignage seulement s’il est fourni et attribuable. Aucune métrique, certification ou satisfaction inventée. Mesurer si la section aide réellement à comprendre le produit. |
| P3.3 — Lien de séance partageable, uniquement sur demande ultérieure | SessionDetailsModal, routage, métadonnées éventuelles. PB | **M–L** ; autorisation produit distincte ; sujet déjà différé | Réutiliser la modale ; lien stable, FR/EN, retour arrière, fermeture et Contact contextualisé. Ne pas confondre avec une refonte obligatoire ; page autonome, FAQ SEO et schema d’offre ne sont pas inclus automatiquement. |

Le wizard d’installation, le panier de livraison, l’approbation complète des sélections, les paiements et les réservations restent hors périmètre. Une liste P3 n’est pas une promesse de réalisation.

## Lots de livraison et critères d’arrêt

1. **Correctifs de lecture** : P0.1–P0.3. Accepter uniquement après comparaison des captures qui démontrent les défauts A01–A04.
2. **Parcours et copie** : P1.1–P1.5. Valider FR/EN et Cadrora/Atelier ; conserver toutes les destinations et fonctions existantes.
3. **Consolidation** : sélectionner les lots P2 à partir des mesures et retours. Éviter de mélanger réorganisation visuelle, refactor CSS et changement du chargement dans une énorme modification.
4. **Explorations** : choisir individuellement les P3 ; ne pas les ajouter silencieusement au chantier visuel.

Arrêter une livraison si une image propriétaire est remplacée temporairement par un défaut compilé, si une photo privée apparaît sans autorisation, si un contrôle important disparaît à petit écran ou si la copie promet une fonction non implémentée. Corriger dans le lot concerné avant de poursuivre.

## Matrice de validation pour l’implémentation future

| Domaine | Scénarios minimaux | Preuve attendue |
| --- | --- | --- |
| Visuel | 320/390 px, tablette, 1440 px ; FR/EN ; clair/sombre ; titres longs ; zoom 200 % | Captures comparables et revue des chevauchements/cadrages |
| Navigation | Liens actuels, ancres, menu, retour au contenu, retour arrière, page inconnue | Parcours clavier et souris/tactile, focus visible |
| Consentement | Première visite, réouverture, refus, accord, révocation ; réglages lents/absents | Aucun chargement/événement analytics sans permission ; panneau utilisable |
| Services | Catalogue vide/en erreur, zéro/un/plusieurs tarifs, champs facultatifs, placements Home/Séances indépendants | Modale et Contact conservant session ; aucun changement des données owner |
| Images | Réglages en attente, override publié, API en erreur, image en erreur, différentes densités d’écran | Requêtes et captures : pas de source provisoire, pas de visage coupé ni saut de layout |
| Galeries | Publique, verrouillée, non listée, hors ligne ; photo/visionneuse ; sélection selon droits | Autorisations inchangées ; image protégée inaccessible avant grant |
| Recherche | Refus, appareil sans caméra, modèle indisponible, parcours sans recherche | Galerie toujours utilisable ; consentement et frontières biométriques inchangés |
| SEO | HTML initial et DOM FR/EN ; canonical, alternates, OG, sitemap, 404 | Réponses HTTP et éléments de head enregistrés |
| Profils | Cadrora, Atelier Giulia et profil studio si primitives communes | Builds appropriés, contenu owner conservé, revue des variantes de présentation |

Commandes minimales lors d’une modification applicative : npm run check, npm run test et npm run build. Pour une modification partagée de profil, produire aussi le build Atelier avec CADRORA_SITE=atelier-giulia selon le guide de déploiement et contrôler le profil studio si affecté. Exécuter les tests Playwright pertinents ; compléter par des essais réels Safari/iPhone pour les parcours qui en dépendent. Les tests locaux, la CI, le déploiement et les appareils sont des preuves distinctes.

## Validation réalisée dans cette phase documentaire

| Commande / contrôle | Résultat et limite |
| --- | --- |
| npm run check | Réussi : typecheck puis lint ; exécuté sur le code applicatif inchangé |
| npm run test | Échec initial : 4 timeouts de 5 s dans tests/unit/scripts/remoteSecrets.test.mjs ; 534 réussis, 1 ignoré |
| npm run test -- tests/unit/scripts/remoteSecrets.test.mjs --testTimeout=20000 | Réussi : 10 tests, 1 ignoré |
| npm run test -- --testTimeout=20000 | Réussi : 104 fichiers, 538 tests, 1 ignoré ; délai changé uniquement pour cette exécution |
| npm run build | Non exécuté : documentation et captures seulement, aucun runtime/routage/configuration/dépendance modifié |
| npm run test:e2e | Non exécuté : parcours ciblés du site public inspectés via Playwright ; pas de nouvelle implémentation |
| Contrôles physiques et de production | Pas de test physique, publication, mutation D1 ou déploiement ; version exacte de production non attestée |
| git diff --check et git status --short | Réussi ; aucun fichier applicatif suivi modifié. Les documents et captures sont non suivis ; pièces jointes et audit Atelier préservés |
| git diff --no-index --check -- /dev/null docs/website-improvement/01-audit.md (puis 02-design-system.md, 03-redesign-blueprint.md et 04-implementation-roadmap.md) | Aucun défaut d’espacement signalé sur les nouveaux fichiers ; code 1 attendu pour une comparaison avec un fichier nouveau ; avertissement de conversion LF → CRLF du dépôt |
| Vérification des liens locaux des quatre documents | Réussie : aucune cible manquante ; 13 captures d’audit conservées dans evidence/cadrora/ |

Les timeouts initiaux restent signalés : le succès avec une fenêtre de 20 s ne prouve pas leur cause. Les journaux de tests incluent des avertissements SQLite expérimental et des reprises R2 de fixtures ; aucun déploiement n’a été lancé par cet audit.

Les quatre fichiers à la racine de ce dossier concernent **Cadrora**. L’audit **Atelier Giulia**, réalisé simultanément dans un autre chat, utilise le sous-dossier atelier-giulia avec accord de l’utilisateur. Ses documents et preuves sont préservés. Les pièces jointes non suivies préexistantes ne font pas partie de ce travail.
