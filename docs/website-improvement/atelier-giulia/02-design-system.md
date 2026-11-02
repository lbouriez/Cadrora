# Atelier Giulia — direction et système visuel proposé

Statut : recommandations du 2 novembre 2026, **non implémentées**. Lire [l'audit](01-audit.md) pour les preuves et [le blueprint](03-redesign-blueprint.md) pour les parcours. Ce document précise les évolutions du système existant ; il ne remplace aucun contrat ni ADR.

## Personnalité : un atelier photographique intime et éditorial

Conserver le crème, l'encre chaude, Playfair Display, le nom en capitales et les images de personnes réelles. Le haut de gamme doit venir du choix des photographies, de leur cadrage, d'une typographie cohérente et de la précision des informations. Éviter les badges décoratifs, les promesses vagues, les animations ajoutées et les séries de cartes identiques sans rôle clair.

L'accueil reste une succession de séances plein écran, conformément à [ADR-043](../../decisions/ADR-043-vertical-home-swiper.md). La sobriété du menu mobile et l'expérience de visionnage photographique sont conservées. Les pages intérieures deviennent plus proches de cette signature : titres éditoriaux, texte courant simple, actions visibles et densité adaptée à la tâche.

## Couleurs : conserver les valeurs, clarifier les rôles

Les couleurs ci-dessous viennent du [thème Atelier](../../../sites/atelier-giulia/theme.css). Aucune palette locale à une page n'est proposée.

| Token existant | HEX clair | Usage recommandé |
| --- | --- | --- |
| `--color-background` | `#F6F1E7` | Fond général crème ; grands espaces de respiration |
| `--color-surface` | `#FBF8F1` | Dialogues, panneau de consentement, zones de lecture |
| `--color-surface-raised` | `#E7DCC8` | Fonds secondaires discrets, séparateurs de sections |
| `--color-text` / `--color-primary` | `#2E2A24` | Titres, texte, action principale pleine sur fond clair |
| `--color-text-muted` | `#6F655B` | Informations secondaires sur fond clair, jamais sur photographie sans support |
| `--color-primary-hover` | `#544B41` | Survol de l'action pleine ; conserver le texte clair |
| `--color-primary-contrast` | `#FBF8F1` | Texte du bouton principal |
| `--color-focus` | `#7F6E58` | Contour visible sur surface claire |
| `--color-border` | `#E7DCC8` | Séparateurs décoratifs ; insuffisant seul pour signaler certains contrôles |
| `--color-on-photo` | `#FFFFFF` | Texte sur photo, avec un fond ou voile dont le contraste a été vérifié |

Calculs sRGB sur aplats opaques : texte/encre sur crème **12,67:1** ; secondaire sur crème **5,06:1** ; papier sur encre **13,44:1** ; focus sur crème **4,36:1** ; bordure sable sur crème **1,21:1**. Ces chiffres ne valent pas pour les photographies, transparences ou états de survol.

Objectif de validation : 4,5:1 pour le texte courant, 3:1 pour le grand texte et les éléments non textuels nécessaires à l'identification des contrôles. Une bordure décorative n'est pas un défaut en soi ; un champ ou contrôle dont elle serait le seul indicateur exige davantage. Références : [contraste du texte, W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [contraste non textuel, W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Raffinement proposé : surcharger `--focus-ring` pour Atelier avec une teinte dérivée de son focus, afin de retirer le halo violet hérité visible sur le petit écran. Garder le contour opaque, et valider un anneau clair ou double sur photographie. Le halo transparent ne constitue pas à lui seul la preuve du contraste.

Le site impose actuellement le mode clair. Les tokens sombres déjà présents (`#2E2A24` fond, `#38332C` surface, `#FBF8F1` texte, `#D6CBBB` secondaire) restent maintenus ; aucune bascule publique ne doit être réintroduite contre le réglage propriétaire. Les modifications partagées devront néanmoins être testées en clair et sombre sur Cadrora.

## Typographie

**Titres et identité : Playfair Display auto-hébergée**, poids 400–500. **Lecture et commandes : pile sans-serif existante**, poids 400, 600 ou 700 selon le rôle. Ne pas ajouter de police distante ni une nouvelle dépendance typographique. Avenir Next n'est pas garanti sur tous les postes ; le rendu Segoe UI/OS fait partie des vérifications.

| Rôle | Téléphone, proposition | Ordinateur, proposition | Règles |
| --- | --- | --- | --- |
| Nom dans l'en-tête | 20–24 px | 28–32 px | Garder le style actuel ; éviter de concurrencer le titre de page |
| Titre de séance plein écran | 40–56 px | 64–96 px | Playfair, interligne 1–1,08 ; 3 lignes maximum visées sur téléphone, adaptation aux vrais titres |
| H1 de page intérieure | 36–44 px | 48–64 px | Playfair, interligne 1,05–1,15 ; Contact plus compact que le hero immersif |
| H2 de section | 28–32 px | 36–44 px | Playfair, pas de gras massif |
| Titre de forfait / dialogue | 20–24 px | 24–28 px | Sans-serif 600–700 pour scanner rapidement les options |
| Paragraphe | 16–18 px | 17–18 px | Interligne 1,5–1,65 ; largeur de lecture 55–68 caractères |
| Sous-titre de hero | 16–18 px | 18–20 px | Une ou deux idées ; éviter l'empilement de deux introductions |
| Bouton | 16 px | 16 px | Une casse et un poids cohérents entre hero, modale et Contact |
| Sur-titre / légende | 12–14 px | 12–14 px | Lettres espacées modérément ; jamais seul support d'une information déterminante |

Ces tailles sont des cibles de maquette, pas un remplacement aveugle des `clamp()` existants. Définir les rôles dans le système partagé lorsqu'ils sont réutilisés, puis choisir leur valeur dans le profil. Ne pas injecter des valeurs individuelles dans chaque page. Tester les textes anglais, les accents français et le zoom avant de figer les plafonds.

Pour Contact : réduire la hauteur occupée par le titre et le texte introductif afin que le courriel et le téléphone soient visibles tôt. Pour les séances : garder la présence photographique, mais une seule description courte au premier écran.

## Grille, espaces et rythme

Réutiliser l'échelle actuelle : **4 / 8 / 12 / 16 / 24 / 32 / 48 px** (`--space-1` à `--space-7`). Un espacement de 64–96 px entre grandes sections peut être défini comme rôle partagé s'il est réellement utilisé ; ne pas multiplier les tokens sans besoin.

| Contexte | Ligne directrice |
| --- | --- |
| Page intérieure | Conteneur existant plafonné à 72 rem ; marges 16–20 px mobile, 32–64 px bureau |
| Lecture | Colonne de 55–68 caractères, alignement à gauche ; centré réservé aux titres/hero courts |
| Contact | Deux actions côte à côte au bureau, empilées sur téléphone ; écart 12–16 px, méthode principale clairement indiquée |
| Forfaits | Liste structurée verticale sur téléphone ; grille seulement si les descriptions restent comparables et lisibles au bureau |
| Portfolio | Photographies dominantes, peu de chrome ; conserver les proportions et le composant éditorial existant |
| Diaporama | Réserver les hauteurs mesurées du header et du footer ; ne pas revenir à des décalages fixes approximatifs |
| Écran court / zoom | Défilement interne utilisable et focus visible ; CTA atteignable ; introduction plus courte plutôt qu'une police minuscule |

La page Contact peut utiliser un fond crème uni : le dégradé radial sombre hérité du fond partagé n'ajoute pas d'information. Ce raffinement relève du thème et doit être comparé au rendu existant avant adoption.

## Composants et états

| Élément | Spécification proposée | Réutilisation |
| --- | --- | --- |
| Action principale | Encre pleine sur papier ; crème sur photo après contraste vérifié ; hauteur conseillée 48 px, minimum contractuel 44 px ; libellé orienté tâche | `Button`, styles `.button`, variante partagée pour le contexte photographique si nécessaire |
| Action secondaire | Texte encre, fond neutre, contour perceptible si requis ; ne pas multiplier les actions pleines concurrentes | Même composant et tokens |
| Bouton icône | Cible 44 × 44 px minimum, nom accessible, état focus/pressed/expanded explicite | `IconButton`, `Icons` ; pas de bibliothèque d'icônes supplémentaire |
| Fiche de séance | Titre, bénéfice court, durée/prix, forfaits, inclusions, conditions, contact ; close sticky conservé | `SessionDetailsModal` et `Modal` ; conserver trap et retour du focus |
| Choix de séance | Ajouter un libellé visible « Choisir une séance » / « Choose a session » ; points existants conservés | Étendre la composition `SessionScrollStory` / `VerticalStorySlider`, pas créer un second slider |
| Forfait | Nom, prix, résumé lisibles séparément ; pas de badge « populaire » calculé/inventé | Rendu des `tariffs` déjà structurés ; leur résumé actuel reste la source tant qu'il n'est pas révisé |
| Collection | Photo + titre + catégorie + courte intention ; lien vers collection, puis prochaine action vers séance/contact | `EditorialGalleryCard`, `PortfolioPage`, `PhotoViewer` |
| Consentement | Hauteur intrinsèque, résumé court, détails accessibles, actions 44 px, focus visible, refus aussi facile que l'acceptation | `PrivacyConsent` ; ne pas accepter automatiquement ni réduire le refus à un lien discret |
| Coordonnées | Actions explicites « Écrire à Giulia » / « Email Giulia », « Appeler » / « Call », adresse lisible/copiable | `InfoPage` et primitives ; `mailto:`/`tel:` conservés |
| État vide | Explication honnête et prochaine action utile ; absence d'image fictive | Réutiliser `EmptyState` si adapté et les traductions publiques |
| Chargement / erreur | Espace réservé, état compréhensible, nouvelle tentative lorsqu'elle est pertinente ; contact de secours indépendant | `FirstFrameReveal`, `Spinner`, `ProgressivePhoto`, fallbacks existants |

Arrondis : conserver les boutons pilules de marque ; surfaces de lecture entre 14 et 24 px suivant les tokens existants. Les photos de portfolio peuvent être plus rectilignes pour éviter un aspect de tableau de bord. Ombres : réservées aux éléments flottants (dialogue, consentement), discrètes ou absentes sur les collections. Bordures fines et séparations par l'espace suffisent sur les contenus statiques.

États indispensables à toute évolution : normal, hover, focus-visible, actif, désactivé/pending lorsque l'action en a réellement besoin, erreur et succès annoncé. Pour la copie d'adresse : confirmation localisée avec le composant de retour existant ; en cas d'échec du presse-papiers, garder le texte sélectionnable.

## Photographies, illustrations et droits

- Utiliser exclusivement des images dont la publication par Atelier est autorisée ; un visage déjà présent dans une galerie privée n'est pas une autorisation de portfolio.
- Préserver le langage noir et blanc de l'accueil. Des photographies couleur peuvent exister dans les collections si cela représente le travail de Giulia ; ne pas imposer un filtre global à toutes les livraisons.
- Choisir des compositions avec une zone calme pour les titres. À 390 px et 320 px, les cadrages doivent préserver les visages importants et le sens de la scène. Réutiliser `photoAlignment` et `mobilePhotoAlignment` avant d'ajouter un outil de recadrage.
- Le voile doit garantir la lisibilité du texte sans assombrir toute la photographie inutilement. Tester chaque photo publiée ; un ratio calculé entre tokens ne valide pas un texte sur image.
- Utiliser `ProgressivePhoto` pour toute image publique et `BrandPhoto` pour les assets compilés. Aucun `<img>` direct supplémentaire. Garder les proportions, sources responsives, révisions et gates de données.
- Des photos de séance et de Giulia constituent les preuves pertinentes. Aucune illustration IA, faux client, fausse capture de réservation, logo de certification ou compteur n'est nécessaire.
- Alternatives : décrire l'information utile sans noms non autorisés, surinterprétation émotionnelle ni bourrage de mots-clés. Les images décoratives et couvertures dont le lien adjacent donne déjà tout le sens peuvent rester sans texte alternatif.

## Mouvement et comportement responsive

La transition verticale normale de 1 200 ms et la parallaxe font partie de l'ADR accepté. Les conserver dans la première étape de refonte ; ne pas les remplacer par un défilement traditionnel sous couvert de simplification. L'arrêt en fin de parcours, le footer sur la dernière slide, l'exclusion des slides inactives du focus et la priorité du défilement du texte sont aussi des invariants.

Le mode système de réduction du mouvement reste immédiat, sans parallaxe. Éviter d'ajouter des animations d'entrée autonomes aux titres, des compteurs, un curseur personnalisé ou des éléments qui bougent pendant la lecture des tarifs. Les boutons peuvent conserver une transition brève de couleur de 160–260 ms, supprimée si nécessaire avec le mouvement réduit.

Menu mobile : conserver le plein écran, le retour du focus et les entrées généreuses. Langue accessible dans le menu, Contact clairement repérable. Si un accès direct au contact est ajouté hors menu, vérifier qu'il ne couvre ni pagination, ni consentement, ni zone sûre du téléphone.

## Critères de cohérence

Avant livraison d'une implémentation : comparer Home, About, Portfolio, Contact, une fiche courte et une longue en FR/EN à 320, 390 et 1440 px, plus paysage et zoom. Un visiteur doit retrouver la même marque, identifier l'action suivante, lire les prix sans chercher et utiliser le clavier sans perdre le focus. Aucune nouvelle dépendance n'est requise pour cette direction.
