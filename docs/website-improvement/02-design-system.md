# Cadrora — direction visuelle et système de design

Proposition du 2 novembre 2026. Ce document est une spécification de travail ; aucun token, composant ou asset applicatif n’a été modifié. Il répond aux constats [A01–A16 de l’audit](01-audit.md).

## Intention

**Une galerie photographique chaleureuse, précise et indépendante.** La photographie donne le caractère ; l’interface explique et accompagne. Conserver le diaphragme multicolore, le framboise, l’encre prune et la chaleur du fond. Réduire les halos, la multiplication d’ombres et les dégradés sous du texte. Une typographie plus maîtrisée et des surfaces calmes doivent faire percevoir le soin sans transformer Cadrora en modèle de luxe générique.

La direction s’applique d’abord au profil Cadrora. Les corrections de lisibilité, focus, contrôles et responsive doivent bénéficier au cœur partagé. La direction artistique d’Atelier Giulia et ses choix de police restent propres à son profil, conformément à [ADR-013](../decisions/ADR-013-site-profiles.md).

## Palette sémantique proposée

La majorité des valeurs existe déjà dans [tokens.css](../../src/app/styles/tokens.css). L’amélioration principale porte sur leur emploi, pas sur une nouvelle palette. Toute valeur nouvelle devra être définie comme token commun ou surcharge de profil, jamais comme palette propre à une page.

| Rôle | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| Fond général | #FFFAF7 | #120F18 | Toile calme ; atténuer fortement les halos sur les pages de lecture |
| Surface | #FFFFFF | #1D1824 | Cartes, détails de séance, panneaux |
| Surface secondaire | #FFF1EA | #2A2031 | Encadrés de contexte, preuve ou étapes |
| Texte principal | #23172A | #FFF8FC | Titres, corps et labels importants |
| Texte secondaire | #6F6275 | #C8BACD | Explications sur la surface correspondante ; jamais transféré aveuglément sur une surface inversée |
| Bordure décorative | #DFD4E2 | #4A3D50 | Séparateurs de cartes ; ne pas compter sur cette bordure seule pour identifier un contrôle |
| Action primaire | #A72F75 | #F36EB5 | Fond **uni** des actions principales |
| Action au survol | #84245C | #FF91C9 | Fond de survol ; même hiérarchie, sans saut de position |
| Texte sur action | #FFFFFF | #211225 | Contraste lié à l’action du thème courant |
| Focus | #6D4AFF | #B7A7FF | Contour visible, indépendant de la couleur de sélection |
| Texte sur photo | #FFFFFF | #FFFFFF | Avec le voile sémantique existant ; ne pas dériver du fond de page |
| Erreur | #B42318 | #FF8B82 | Message, icône et texte ; jamais couleur seule |
| Succès | #157347 | #75D7A7 | Confirmation d’une action réellement terminée |
| Attention | #9A5B00 | #FFCB72 | Limitation ou état nécessitant une décision |

Le dégradé de marque #FFB45C → #E43B9A → #7137E8 reste disponible pour une signature décorative discrète. Il cesse d’être le fond standard d’un texte de bouton. Les couples proposés blanc/framboise et encre sombre/framboise clair donnent environ 6,35:1 et 6,54:1 par calcul sRGB. Les états survol, désactivé, focus et les compositions sur photo doivent encore être vérifiés dans le navigateur.

Pour la carte admin, privilégier une surface ordinaire avec un badge « Lecture seule ». Si une carte inversée est conservée, ajouter une paire explicite de tokens pour son fond et ses textes, puis tester les deux thèmes. Ne pas utiliser le token global de texte atténué sur un fond dont la luminosité a été inversée.

## Typographie

**Famille principale :** pile sans empattement existante, Inter lorsqu’elle est disponible, puis ui-sans-serif/system-ui/Segoe UI. **Famille secondaire :** la même pile, en graisse 400–500 pour le texte et 600–700 pour les repères. Aucun ajout de police n’est nécessaire pour cette phase. Ne pas importer Playfair d’Atelier dans Cadrora ni ajouter de Google Fonts.

Inter dans une déclaration CSS n’est pas une garantie de rendu identique entre systèmes. Valider les retours de ligne avec la police réellement utilisée. Une future police locale dédiée demanderait une décision distincte sur licence, poids, fallback et chargement ; ce n’est pas un prérequis de la refonte.

| Niveau proposé | Ordinateur | Téléphone | Interligne / largeur |
| --- | --- | --- | --- |
| H1 accueil | 56–72 px, fluide | 36–44 px | 1,05–1,12 ; viser 12–18 caractères par ligne selon le contenu |
| H1 intérieur / À propos | 44–56 px | 32–40 px | 1,10–1,18 ; une seule échelle partagée adaptée à la colonne |
| H2 section | 32–40 px | 26–32 px | 1,15–1,25 |
| H3 carte | 22–26 px | 20–24 px | 1,20–1,30 |
| Introduction | 18–20 px | 17–18 px | 1,55–1,65 ; 50–65ch au maximum |
| Corps | 16–18 px | 16–18 px | 1,55–1,70 ; 60–70ch maximum |
| Boutons et navigation | 15–16 px | 15–16 px | ≥1,25 ; permettre deux lignes si nécessaire |
| Légendes | 14 px | 14 px | ≥1,45 ; ne pas y reléguer un prérequis essentiel |
| Surtitre | 12–14 px | 12–14 px | Majuscules facultatives ; espacement modéré |

Ces plages sont des cibles, à traduire en tokens et clamp, pas des tailles à recopier page par page. Réduire les poids extrêmes et l’interlettrage négatif des longs titres. Pour À propos, tester explicitement « Un exemple de présentation du studio » : aucune lettre ne doit entrer dans la colonne photo, même si la largeur du document reste correcte. Prévoir une rupture de secours des mots longs et une composition à une colonne lorsque le contenu ne tient plus.

## Espacement et grille

- Conserver la base 4, 8, 12, 16, 24, 32, 48 px. Définir, si nécessaire, des tokens de section pour 64 et 96 px au lieu de nombres isolés.
- Garder le conteneur de lecture de 72rem maximum. Les galeries peuvent conserver leur conteneur large existant ; leur densité ne doit pas être dictée par la page marketing.
- Marges latérales : 16–20 px sur téléphone, 24–32 px sur tablette, centrage du conteneur sur bureau. Aucun élément essentiel collé à une encoche ou au bas d’une zone système.
- Espacement des sections : 48–64 px sur téléphone, 72–96 px sur ordinateur. À l’intérieur d’un bloc : titre → texte 16 px, texte → actions 24 px, éléments de carte 12–16 px.
- Hero bureau : deux colonnes équilibrées, texte et preuve produit. Sur téléphone : promesse courte, action, preuve visuelle, détails complémentaires. Conserver un ordre DOM de lecture cohérent ; éviter des réordonnancements qui rendent le clavier incohérent.
- Grilles de séances/collections : une colonne sur téléphone, deux lorsque les cartes peuvent garder au moins environ 280 px, trois sur grand écran. Le contenu et la lisibilité déterminent le point de rupture final.
- Ne pas imposer de hauteur fixe au texte pour aligner artificiellement les cartes. Employer des zones extensibles et des actions alignées au bas lorsque cela ne crée pas de vide excessif.

## Composants : faire évoluer l’existant

| Composant / famille | Spécification proposée | États et limites à conserver |
| --- | --- | --- |
| Button et liens .button | Primaire uni ; secondaire à surface neutre ; texte d’action court et spécifique ; 44 px minimum, 48 px recommandé pour l’action majeure mobile | Survol, focus, pression, chargement, désactivé ; lien pour navigation, bouton pour action |
| IconButton / contrôles du header | Cible 44 × 44 px ; icône cohérente issue d’Icons ; nom accessible localisé | FR/EN et thème restent disponibles selon les réglages ; ne pas inventer un nouveau pack d’icônes |
| PublicLayout | En-tête moins flottant ; nom de marque mobile quand il tient ; lien d’évitement ; navigation actuelle conservée | États ouverts/fermés, Échap, indication de page courante, règles de visibilité owner |
| PublicPageIntro | Échelle intérieure commune ; introduction plus courte ; espace vers la première photo réduit | Un seul H1 ; aucune coupure de titre FR/EN ou à 200 % |
| DemoExperienceCards | IA vedette conservée ; rôle « invité/propriétaire » explicite ; autres essais hiérarchisés ; carte admin lisible | Ne pas présenter la lecture seule comme une possibilité de publier/modifier |
| ServicePhotoHeader / SessionDetailsModal | Photo et titre cohérents, texte descriptif court ; détails/tarifs/inclusions restent dans la modale | Zéro, un ou plusieurs tarifs ; absence de champs optionnels ; fermeture et retour du focus |
| EditorialGalleryCard / PublicEventCards | Hiérarchie catégorie → titre → contexte ; photos prioritaires ; bordure légère | Carte privée : couverture générique, jamais une image privée avant autorisation |
| ProgressivePhoto / BrandPhoto | Cadre réservé ; proportions et points focaux validés ; priorité seulement pour les images utiles à l’entrée | Attendre les sources du propriétaire ; conserver échec image, preview et variantes publiées |
| PrivacyConsent | Hauteur déterminée par le contenu résolu ; actions lisibles ; absence de vide réservé après résolution | Pendant l’attente : état stable ; choix nécessaire disponible ; analytics jamais présélectionné ni chargé sans accord |
| Modal / Drawer / PhotoViewer | Surfaces calmes et commandes nettes ; marges sûres ; scroll interne accessible | Piège de focus, arrière-plan inert, Échap, restitution du focus, photo entière disponible |
| Formulaires de déverrouillage/connexion | Labels permanents, aide liée au champ, erreurs localisées proches de leur cause | Ne pas inventer de formulaire de contact ; ne pas retirer Turnstile ou contrôles serveur |
| Spinner / EmptyState / Toast | Expliquer l’état réel et la prochaine action ; annoncer les erreurs utiles sans agitation | Ne pas déclarer une recherche réussie, un upload publié ou une sauvegarde faite prématurément |

Les liens CTA existants utilisent souvent les classes de Button pour garder leur sémantique. Harmoniser leurs styles avant de proposer une nouvelle abstraction. Si leur duplication crée des divergences réelles, faire évoluer la primitive typée existante, sans composant parallèle réservé à l’accueil.

## Images, preuve produit et iconographie

1. Conserver le logo canonique dans public/brand/cadrora-logo.png. Le multicolore sert de signature ; les surfaces environnantes restent sobres.
2. Produire, lors de l’implémentation, une capture réelle d’une galerie Cadrora de démonstration ou de son administration en lecture seule. Une légende « Exemple de galerie Cadrora » distingue interface produit et photographie. Aucune fausse capture de fonctions non disponibles.
3. Employer les photographies déjà autorisées et les démos identifiées comme fictives. Éviter une nouvelle illustration abstraite de serveur ou d’IA : elle explique moins bien le produit qu’une galerie utilisable.
4. Pour Atelier Giulia, utiliser le lien et le logo déjà configurés ; une capture ou un témoignage supplémentaire demande une vérification de provenance et d’autorisation. Ne pas transformer cette référence en affirmation de satisfaction.
5. Préserver les visages à 320, 390 et 1440 px. Utiliser les points focaux existants par défaut/téléphone ; la visionneuse doit permettre de voir l’image entière.
6. Tout nouvel asset public passe par BrandPhoto/ProgressivePhoto, avec description alternative utile ou alt vide si purement décoratif. Les mots de l’interface doivent rester du vrai texte, pas être enfermés dans une capture.
7. Aucun téléchargement distant obligatoire, nouvelle fonte distante, vidéo automatique ou nouveau fournisseur d’assets pour cette refonte.

## Bordures, rayons, ombres et mouvement

Garder les rayons existants : 8 px pour petits éléments, 14 px pour cartes, 24 px pour surfaces importantes et pilule pour les boutons. Réduire la fréquence des grands arrondis imbriqués. Une bordure discrète suffit à la majorité des cartes ; shadow-sm pour un état flottant et shadow-lg pour une vraie superposition. Le header ne doit pas porter une ombre plus spectaculaire que la photo principale.

Conserver les tokens de mouvement de 160/260 ms pour les interactions. Les apparitions de contenu peuvent être raccourcies après mesure ; éviter de cumuler écran d’attente, apparition du bloc et apparition du texte. Les éléments nécessaires à comprendre ou quitter une page restent accessibles indépendamment de l’animation. prefers-reduced-motion doit supprimer les transformations non essentielles et conserver tous les contenus.

## Accessibilité et validation visuelle

Le texte normal vise au moins 4,5:1 ; le grand texte au moins 3:1 selon la [définition W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Conserver les cibles de 44 px du dépôt. Vérifier les contours de contrôle/focus sur leurs surfaces réelles ; une bordure décorative claire n’est pas une preuve de contraste suffisant.

Revue attendue avant livraison d’un changement : FR/EN, clair/sombre, 320/390 px et bureau, titre long, contenu vide, chargement, erreur API, erreur image, navigation clavier, menu, modale et consentement avec/sans Analytics. Vérifier le zoom 200 % et la redistribution équivalente à 320 px, sans conclure à partir de la seule absence de scroll horizontal. La photo d’À propos démontre pourquoi les boîtes de texte doivent aussi être inspectées.

Critère esthétique : un visiteur doit distinguer immédiatement la promesse, la prochaine action et une preuve réelle du produit. Les photos doivent rester plus présentes que les ombres, badges et décors. Ce critère sera jugé sur captures comparables et tests de compréhension, pas présenté comme un gain de conversion garanti.
