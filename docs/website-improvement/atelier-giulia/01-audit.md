# Atelier Giulia — audit du site existant

Date : **2 novembre 2026**, America/Toronto. Périmètre : [ateliergiulia.com](https://ateliergiulia.com), son profil dans Cadrora et les composants publics partagés. Phase de diagnostic uniquement : aucun code applicatif, réglage de production, contenu D1 ou déploiement modifié.

## Synthèse

Le site possède une identité reconnaissable : photographie immersive en noir et blanc, Playfair Display, fond crème, navigation sobre. La priorité est de rendre l'offre aussi convaincante et accessible que cette direction visuelle. Le parcours conduit actuellement vers un portfolio vide ; la première séance ne donne ni durée ni tarif ; le contact ne nomme pas la région ; le panneau de confidentialité recouvre le CTA sur téléphone. Une simulation de panne révèle surtout l'absence de coordonnées de secours sur Contact.

La refonte recommandée conserve le diaporama vertical approuvé et l'architecture existante. Elle améliore d'abord la continuité du contact, les preuves photographiques, l'information commerciale et la lisibilité mobile. Aucun gain de conversion n'est chiffré : les données de trafic et de réservations ne sont pas disponibles.

## Méthode et limites

- **[V] Vu** : rendu du site de production, interactions et réponses HTTP publiques observés ce jour.
- **[C] Code** : comportement identifié dans le checkout local `b922165c0331ed52f62897a2b16d1de68812ed8a`. Le commit déployé n'a pas été établi ; ne pas assimiler les deux.
- **[R] Recommandation** : proposition à mettre en œuvre ultérieurement.
- **[H] Hypothèse** : effet utilisateur ou commercial plausible, à vérifier.

Inventaire de vérification : première visite/consentement, accueil et sélection de séance, fiche courte et fiche longue, contact avec contexte, portfolio, À propos, menu/retour du focus, FR/EN, petits écrans, réduction des animations, métadonnées et panne des API optionnelles. Les contrôles ont été réalisés avec Playwright/Chromium, sans envoyer de message, téléphoner, réserver ni accéder à l'administration.

| Surface | Vérification réalisée | Limite |
| --- | --- | --- |
| Ordinateur 1440 × 1000 | Accueil, fiches famille/maternité, Contact, portfolio, À propos ; lecture Privacy | Pas de mesure de conversion ni de certification d'accessibilité |
| Téléphone émulé 390 × 844 | Première visite, refus de l'analyse, menu, changement FR/EN, fiche anniversaire complète, Contact, portfolio, À propos | Pas de véritable iPhone/Android ni de Safari |
| Petit écran 320 × 568 | Accueil : CTA initialement hors de la zone visible, rendu accessible en lui donnant le focus ; pas de débordement horizontal | Pas de validation exhaustive à 200 % de zoom |
| Paysage 844 × 390 | Séance maternité, CTA visible après chargement, réduction du mouvement : transition calculée à 0 s | Un état de séance, pas toute la matrice |
| Cas dégradé | Nouveau contexte ; interception locale et abandon de `/api/v1/site` et `/api/v1/services` | Simulation navigateur, pas une panne provoquée côté serveur |
| SEO | HTML FR/EN, canonical/alternates, robots, sitemap, statuts Sessions | Ni Search Console, ni indexation effective, ni résultats enrichis vérifiés |

Preuves : captures dans [evidence](../evidence/), [observations structurées](../evidence/observations.json) et [réponses HTTP sélectionnées](../evidence/http-observations.json). Les captures représentent des états datés ; les contenus gérés par la propriétaire peuvent évoluer.

## Architecture et inventaire

### Technologies et responsabilités [C]

| Couche | Existant | Conséquence pour la refonte |
| --- | --- | --- |
| Client | React 19, TypeScript strict, Vite 8, React Router 7 | Améliorer les routes et compositions existantes ; aucune réécriture nécessaire |
| État et langue | TanStack Query 5, i18next/react-i18next ; FR/EN | D1 prime sur les valeurs compilées ; tout nouveau texte existe dans les deux langues |
| Styles | CSS partagé, variables sémantiques, thème du profil ; pas de framework CSS utilitaire identifié | Modifier les tokens et les composants propriétaires, pas créer des palettes par page |
| Composants | Primitives internes typées : Button, IconButton, Modal, Drawer, Input, Toast, etc. | Réutiliser le focus, les états et les dimensions déjà prévus |
| Images | `ProgressivePhoto`, `BrandPhoto`, `ServicePhoto`, sources par révision | Conserver les attentes des requêtes avant de monter les sources propriétaire |
| Mouvement | Swiper 14 via `VerticalStorySlider` ; Embla 8 pour d'autres carrousels | Aucun nouveau moteur d'animation nécessaire |
| Backend | Hono 4, Cloudflare Worker, schémas Zod 4, D1, R2 privé, Vectorize optionnel | Autorisations et publication restent indépendantes du marketing |
| Fonctionnel | Import/encodage navigateur, galeries privées, favoris, sélection de retouche, téléchargements ; recherche faciale locale optionnelle | Préserver ces parcours, sans en faire des étapes obligatoires de prospection |
| Validation | ESLint, TypeScript, Vitest, Playwright ; génération HTML localisé au build | Régressions des profils Cadrora et Atelier à vérifier lors de l'implémentation |

Sources : [package.json](../../../package.json), [architecture](../../architecture.md), [contrats](../../technical/contracts.md), [plan de packages](../../implementation-plan.md), [guide du site public](../../technical/public-website.md).

### Routes et état réellement actif

| Route | Rôle | Observation / source |
| --- | --- | --- |
| `/`, `/fr/`, `/en/` | Accueil immersif | [V] Cinq séances : famille, maternité, portraits, couples, anniversaire |
| `/services` et variantes FR/EN | Catalogue des séances | [V] Désactivé : HTTP 404 ; lien absent du menu. C'est un réglage, pas un lien cassé |
| `/portfolio` et variantes | Collections publiques permanentes | [V] Aucune collection ; message d'attente et aucune action dans le contenu principal |
| `/portfolio/:slug` et variantes | Collection et visionneuse | [C] Existe ; [V] non parcouru faute de collection publique |
| `/about` et variantes | Présentation de Giulia | [V] Portrait propriétaire, court texte, CTA vers Contact |
| `/contact` et variantes | Courriel/téléphone, carte volontaire, prochaines étapes | [V] Coordonnées présentes lorsque les réglages répondent ; région et adresse textuelles vides |
| `/privacy` et variantes | Confidentialité et explications | [V] Page disponible ; contenu de politique lu, sans audit juridique |
| `/galleries` | Répertoire clients | [V] Réglage désactivé, absent du menu/sitemap ; URL renvoie une enveloppe HTTP 200 avec `noindex,nofollow` |
| `/e/:slug`, `/e/:slug/photo/:photoId`, `/e/:slug/find` | Livraison client et recherche optionnelle | [C] Routes existantes ; aucune galerie privée ouverte pendant l'audit |
| `/admin/*` | Gestion | [C] Authentification et capacités conservées ; hors audit visuel |

Sources : [routes publiques](../../../src/app/routes/publicRoutes.tsx), [App](../../../src/app/App.tsx), [site public](https://ateliergiulia.com), [réglages publics](https://ateliergiulia.com/api/v1/site), [catalogue public](https://ateliergiulia.com/api/v1/services).

### Offre, audience et conversion

[V] L'offre visible vise les familles, futures mères, personnes souhaitant un portrait, couples et parents organisant un anniversaire. Les textes décrivent une approche douce, naturelle, sans poses figées ; la présentation de Giulia mentionne son origine italienne et son installation au Canada. Les offres détaillées mentionnent des déplacements inclus sur la Rive-Sud. Cela ne suffit pas à inventer une ville d'implantation ou une liste de municipalités desservies.

[V] La fiche famille contient des inclusions génériques, sans durée ni tarif. Les quatre autres séances de l'accueil ont des forfaits structurés. Les fourchettes affichées sont 350–750 CAD en maternité, 250–650 CAD en portrait, 300–650 CAD en couple et 250–650 CAD en anniversaire. Ce sont des contenus existants, pas des prix recommandés. Leur statut fiscal et les délais de livraison complets restent à confirmer auprès de la propriétaire.

[V] Le catalogue API inclut aussi une offre entreprise, non sélectionnée pour l'accueil. Avec la page Sessions désactivée, elle n'est pas découvrable par le parcours marketing inspecté. Ne pas l'ajouter automatiquement à l'accueil : clarifier d'abord si elle doit être commercialisée.

Parcours principal actuel : photographie → « Découvrir cette séance » → fiche modale → « Parlons de votre séance » → Contact contextualisé → lien `mailto:` ou `tel:`. Il n'existe ni formulaire public ni réservation/paiement en ligne dans ce parcours. Le contexte `?session=…` est affiché sur Contact, mais le lien courriel ne le reprend pas. Une ouverture du client courriel n'est pas une demande envoyée, encore moins une réservation.

Parcours secondaire : accueil → portfolio → collection → contact. Il s'arrête actuellement sur un état vide. Le parcours de livraison client par lien privé est distinct et doit le rester.

### Marque et intégrations

[C/V] Crème `#F6F1E7`, papier `#FBF8F1`, sable `#E7DCC8`, encre `#2E2A24`, texte secondaire `#6F655B`. Playfair Display est auto-hébergée ; le texte courant utilise une pile Avenir Next/Segoe UI/sans-serif dépendante de l'OS. L'accueil et À propos utilisent la serif ; Contact et Portfolio ont de grands titres sans-serif gras. Le logotype textuel en capitales domine l'en-tête ; le fichier logo reste utilisé pour les icônes de marque.

[V] Le mode est fixé à clair, FR/EN sont actifs et l'avis de site en préparation est actif. GA4 est configuré. Après « Nécessaire seulement », aucun script Google Tag Manager n'est présent dans la page inspectée. [C] L'intégration mesure explicitement les vues des pages marketing après consentement, exclut galeries privées/admin et retire les paramètres de requête de l'URL envoyée. Aucun événement métier explicite de consultation des forfaits ou de clic contact n'a été trouvé dans cette intégration ; les réglages du compte GA4 et ses mesures automatiques n'ont pas été consultés.

[C/V] Le contact utilise des liens directs ; la carte est chargée après action. Le lien externe observé ouvre Google Maps, tandis que l'intégration embarquée peut utiliser OpenStreetMap. Aucun besoin de nouvelle plateforme de formulaire, de paiement, de CRM ou de tracker n'est démontré.

## Recherche comparative

Quatre références pertinentes ont été consultées le 2 novembre 2026. Le corpus est qualitatif, pas un classement de performances commerciales. Aucun témoignage ni contenu photographique concurrent ne doit être repris pour Atelier.

| Référence et sources | Structure, conversion et confiance observées | Visuel/mobile et opportunité pour Atelier |
| --- | --- | --- |
| **Maria Rios**, [accueil](https://www.mariariosphotographe.com/), [services](https://www.mariariosphotographe.com/services/) | Positionnement géographique explicite, chemins familles/entreprises, témoignages publiés, forfaits avec durées/livrables, FAQ et lien de réservation externe. | L'extraction textuelle est disponible ; Chromium rencontre un contrôle Cloudflare sur ordinateur et mobile. Qualité visuelle, menu et ergonomie mobile **non évalués**. Atelier peut rendre région, offre et modalités aussi faciles à trouver, avec un contact direct autonome. |
| **Maude Carrière**, [accueil](https://www.maudecarrierephotographe.com/), [tarifs](https://www.maudecarrierephotographe.com/tarifs/) | Navigation vers spécialités, tarifs, présentation et contact ; récits photographiques et témoignages sur l'accueil ; prix/durées, FAQ et réservation sur la page tarifs. | Même limite Cloudflare : aucun jugement sur les couleurs, cadrages ou interactions mobiles. Le contenu extrait expose aussi du texte de gabarit sur Tarifs, dont la visibilité réelle n'est pas établie. Atelier doit privilégier une offre complète et relue plutôt qu'accumuler les sections. |
| **Catherine Bilodeau**, [accueil](https://catherinebilodeauphotographe.com/), [forfaits](https://catherinebilodeauphotographe.com/forfaits) | Accueil photographique, présentation personnelle, portfolio par spécialité et témoignages. Forfaits avec contenu concret et liens Contact répétés ; questions pratiques. | [V] Images couleur immersives ; localisation visible ; navigation au bas du premier écran sur ordinateur, sous le visuel avec menu sur téléphone. Plusieurs petits textes sur photo demandent de l'attention. Atelier peut conserver son header supérieur et son style monochrome tout en rendant contact et tarifs plus immédiats. |
| **Valérie Paquette**, [page Lifestyle](https://valeriepaquette.com/lifestyle/) | Page de service : intention, public visé, séances réelles, investissement, témoignages, contact. Les livrables et prix accompagnent les exemples. | [V] Hero noir et blanc, serif expressive, accent jaune sur menu ; titre reflow sur téléphone. L'appel à réserver arrive après le premier écran. Atelier peut garder un CTA dès le hero et raccourcir le chemin vers les détails. Cette page est une référence de parcours de service, pas un audit de tout son accueil. |

Captures : [Catherine ordinateur](../evidence/catherine-desktop.jpg), [téléphone](../evidence/catherine-mobile.jpg), [Valérie ordinateur](../evidence/valerie-desktop.jpg), [téléphone](../evidence/valerie-mobile.jpg). Les captures `maria-*` et `maude-*` documentent seulement le blocage, pas leur design.

Différenciation proposée [R/H] : une signature photographique intime, une voix personnelle de Giulia, un accès rapide aux détails et un contact qui fonctionne même quand les services de galerie sont indisponibles. L'intérêt commercial de cette combinaison reste à mesurer ; ne pas copier les tarifs, les textes ou les outils de réservation concurrents.

## Constats et corrections proposées

Sévérité : **haute** = confiance, accès au contact ou information déterminante ; **moyenne** = effort supplémentaire ou incohérence ; **faible** = finition. Ces niveaux ne signalent pas un incident de sécurité. Les priorités d'exécution figurent dans [la feuille de route](04-implementation-roadmap.md).

| ID | Localisation et fait | Sévérité / impact probable [H] | Solution proposée [R] |
| --- | --- | --- | --- |
| A01 | Contact, API interrompue : plus de courriel ni téléphone, seulement un message d'attente. Accueil dégradé : services compilés plus larges que l'offre active. [V/C] | Haute : perte du moyen de prise de contact pendant une panne ; offre de secours potentiellement trompeuse | Configurer les coordonnées publiques de fallback et un contenu de secours validé. Conserver l'attente des requêtes avant tout fallback d'image |
| A02 | Première visite 390 × 844 : panneau de consentement d'environ 464 px, au-dessus du CTA. Le CSS impose `height: 29rem` sur mobile. [V/C] | Haute : plus de la moitié de l'écran consacrée au consentement ; action commerciale masquée | Panneau à hauteur intrinsèque, texte bref, choix de refus/acceptation aussi accessibles ; réserver sa place ou adapter la composition sans cacher le CTA |
| A03 | Portfolio, premier lien du menu : aucune collection, message générique sans prochaine action dans le contenu. [V] | Haute : promesse de preuve visuelle non tenue | Publier des collections réelles autorisées ; en attendant, rendre l'état vide utile avec accès aux séances/contact et revoir sa priorité de navigation |
| A04 | Première fiche « Portraits et familles » : durée et prix vides ; inclusions famille/couple/maternité/nouveau-né qui recoupent les autres offres. [V] | Haute : comparaison impossible et périmètre ambigu | Définir l'offre famille ou une mention explicite de devis, ses inclusions et sa distinction ; ne pas déduire ses tarifs de ceux du portrait |
| A05 | Région/adresse textuelles vides ; Contact parle de « cette région » et d'un rayon d'environ 50 km sans nommer le point de départ. [V] | Haute : visiteur incapable de vérifier rapidement si la séance est possible près de chez lui | Renseigner une région confirmée et la rendre visible dans l'accueil et Contact ; carte en complément, sans transformer le rayon en limite contractuelle |
| A06 | Fiche anniversaire mobile : contenu défilant de 1 980 px pour 844 px visibles ; long paragraphe avant durée, prix et CTA final. [V] | Moyenne : lecture coûteuse avant la décision | Résumé court, prix/durée visibles tôt, forfaits comparables, CTA initial puis final ; conserver tous les détails et conditions |
| A07 | Contact contextualisé : l'objet/la séance n'apparaît pas dans le `mailto:` ; le courriel arrive sous le téléphone et sous le premier écran à 390 px avec contexte. [V/C] | Moyenne : répétition et effort supplémentaire | Remonter les deux actions, préremplir un objet localisé avec la séance validée ; proposer copier l'adresse comme secours |
| A08 | Séances accessibles par cinq points du diaporama, sans libellés visuels ; page Sessions volontairement désactivée. [V] | Moyenne : découverte/comparaison moins évidente ; l'offre entreprise reste hors du parcours | Ajouter un choix explicite des séances à l'accueil/menu. Réactiver le catalogue seulement si la propriétaire veut cette page |
| A09 | Accueil et À propos : titres blancs traversant des plages photographiques claires, notamment à gauche sur petit écran. [V] | Haute pour la lisibilité locale ; conformité exacte sur photo non mesurée | Réviser voile et placement, vérifier le contraste sur tous les cadrages ; ne pas considérer une ombre de texte comme une garantie |
| A10 | Contact/Portfolio : titres sans-serif très gras et grands, alors que Home/About utilisent Playfair. Anneau de focus violet hérité visible sur le CTA crème à 320 px. [V/C] | Moyenne : rupture de personnalité et poids excessif du titre sur Contact | Unifier les titres marketing et le focus au niveau sémantique/profil ; conserver la sans-serif pour les fonctions et petits textes |
| A11 | Avis « site en préparation » présent partout. [V] | Moyenne : signal durable d'inachèvement ; consomme de la hauteur mobile | Le conserver tant que pertinent, puis le désactiver via le réglage existant après complétion du contenu, sans masquer un vrai état provisoire |
| A12 | À propos : CTA « Réserver ma séance » mène à Contact, pas à un calendrier. Le portrait et une seule biographie portent la preuve personnelle. [V/C] | Moyenne : attente de réservation immédiate ; méthode peu concrète | « Parlons de votre séance » ; enrichir avec un déroulement réel et quelques réponses utiles validées |
| A13 | Anglais : « Portraits Photography », libellés de forfaits et formats de devises FR/EN mélangés dans le catalogue. [V] | Moyenne : impression de contenu moins soigné | Révision bilingue des titres, tarifs et ponctuation ; même sens et mêmes montants dans les deux langues |
| A14 | Portrait À propos : alternative propriétaire vide, transmise comme `alt=""`. [V/C] | Faible à moyenne : information de présentation potentiellement perdue | Déterminer si l'image apporte une information ; si oui décrire sobrement Giulia après validation. Une image réellement décorative peut conserver un alt vide |
| A15 | Intégration GA4 : vues de pages explicites, pas d'événements métier dans le module inspecté. [C] | Moyenne : impossible d'attribuer une amélioration au parcours sans instrumentation ciblée | Mesurer après consentement consultation de séance et clic de contact ; aucune donnée saisie/biométrique ni identifiant de galerie privée |
| A16 | Home à 320 × 568 : CTA hors du premier cadre, accessible au focus par défilement interne ; pagination 44 × 44 px correctement nommée. [V] | Moyenne : possibilité d'agir préservée, découvrabilité insuffisante | Raccourcir l'introduction répétitive, vérifier titres longs et zoom ; garder la gestion de débordement existante |
| A17 | Partage : `og:image` utilise l'image Home configurée, distincte de la première séance réellement affichée. [C/V pour l'URL] | Faible : cohérence potentielle du partage à vérifier, sans affirmer que l'image est incorrecte | Examiner le rendu de l'aperçu social et confirmer sa photographie/son droit d'usage ; pas d'optimisation fondée sur une supposition |

Preuves principales : [première visite mobile](../evidence/atelier-home-mobile-first.jpg), [accueil après choix](../evidence/atelier-home-mobile-clear.jpg), [portfolio vide](../evidence/atelier-portfolio-desktop.jpg), [contact mobile](../evidence/atelier-contact-mobile.jpg), [contact en panne](../evidence/atelier-contact-api-failure.jpg), [fiche anniversaire](../evidence/atelier-birthday-mobile.jpg), [fin de fiche](../evidence/atelier-birthday-mobile-bottom.jpg), [petit écran initial](../evidence/atelier-home-320.jpg), [CTA révélé au focus](../evidence/atelier-home-320-scrolled.jpg).

## Ce qui fonctionne et doit être préservé

- [V] Les photos propriétaire s'affichent ; aucune image manifestement cassée dans les états stabilisés inspectés. Le commentaire de fallback provisoire dans `site.ts` ne prouve pas que les photographies actuellement publiées sont des photos de démonstration.
- [V] Menu mobile sobre, grandes entrées, fermeture Échap et retour du focus sur son bouton ; même retour du focus pour la fiche de séance.
- [V] Les cibles des points de séance mesurent 44 × 44 px et ont un nom accessible. L'indicateur visuel peut être petit sans que sa cible tactile le soit.
- [V] Le CTA final des longues fiches reste accessible par défilement. Aucun débordement horizontal observé dans les contrôles 320, 390 et 844 px effectués.
- [V/C] Mouvement réduit respecté, contacts natifs, carte volontaire, préférence de confidentialité persistée ; aucun besoin de remplacer ces mécanismes.
- [C] Une fiche de séance partagée sert les cartes et les slides ; le rendu progressif des images, les schémas, l'i18n et les publications constituent une base solide.

## SEO, performance et points non établis

[V] Les HTML FR/EN disposent de titres/descriptions localisés, canonical, `hreflang` réciproques, Open Graph et Twitter. Le sitemap inclut Home, Portfolio, About, Contact et Privacy en FR/EN ; Sessions et galeries clients sont absents conformément à leurs réglages. [C] Un JSON-LD `Organization` existe dans le layout. Le socle SEO n'est donc pas à recréer. Une région confirmée, des collections utiles et un contenu cohérent apporteraient davantage qu'une multiplication de pages vides.

[C] Risques à surveiller : révélation conditionnée par réglages/catalogue/photo/police/slider ; attente maximale des métadonnées de 15 s ; chargement Swiper ; images plein écran. Les délais et fallbacks existent déjà. Ne pas les contourner en affichant d'abord une photo compilée qui serait ensuite remplacée.

[V] Une inspection de ressources après navigation révèle des variantes progressives et un fichier portrait grand format d'environ 501 kB décodés/transférés hors en-têtes. Ce n'est ni une mesure initiale à cache froid, ni un problème démontré, ni un score Lighthouse. Prévoir une mesure reproductible avant de modifier la stratégie d'image. Aucun LCP, INP, CLS ou taux de rebond de production n'est établi ici.

Restent à vérifier lors de l'implémentation : Safari réel, VoiceOver/NVDA, zoom 200 %, tous les cadrages FR/EN, galeries privées avec fixtures autorisées, droits de publication des collections, aperçu social réel, données Analytics/Search Console et délais commerciaux. Les résultats des commandes locales sont consignés dans [la feuille de route](04-implementation-roadmap.md#validation-de-cette-phase).

## Sources du dépôt déterminantes

- [Profil Atelier](../../../sites/atelier-giulia/site.ts), [métadonnées](../../../sites/atelier-giulia/profile.json), [thème](../../../sites/atelier-giulia/theme.css), [tokens partagés](../../../src/app/styles/tokens.css).
- [PublicLayout](../../../src/app/public/PublicLayout.tsx), [SessionScrollStory](../../../src/app/public/SessionScrollStory.tsx), [SessionStoryContent](../../../src/app/public/SessionStoryContent.tsx), [SessionDetailsModal](../../../src/app/public/SessionDetailsModal.tsx).
- [Contact/Privacy](../../../src/app/public/InfoPage.tsx), [Portfolio](../../../src/app/public/PortfolioPage.tsx), [About](../../../src/app/public/AboutPage.tsx), [PrivacyConsent](../../../src/app/public/PrivacyConsent.tsx), [GoogleAnalytics](../../../src/app/public/GoogleAnalytics.tsx).
- [ADR-013 : profils](../../decisions/ADR-013-site-profiles.md), [ADR-043 : accueil vertical approuvé](../../decisions/ADR-043-vertical-home-swiper.md), [ADR-054 : tarifs structurés](../../decisions/ADR-054-session-pricing-packages.md).
