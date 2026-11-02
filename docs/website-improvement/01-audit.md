# Audit du site Cadrora

Date : 2 novembre 2026 · Site : [cadrora.com](https://cadrora.com/) · Révision locale examinée : **b922165**.

Statut : analyse et recommandations uniquement. Aucun code applicatif, contenu D1, paramètre de production ou dépendance n’est modifié par cet audit. La révision exacte déployée n’a pas été attestée ; les observations du navigateur et celles du dépôt sont distinguées.

## Synthèse

Cadrora possède déjà une proposition distinctive : un site de photographe et des galeries sur le compte Cloudflare de son propriétaire, avec une démonstration utilisable sans inscription. Le principal travail consiste à rendre cette proposition plus facile à percevoir et à essayer, puis à rendre l’installation compréhensible. Une reconstruction serait disproportionnée.

Trois défauts observés méritent de précéder l’embellissement : le panneau de confidentialité masque les actions de l’accueil mobile, plusieurs contrastes sont faibles et le titre français d’À propos déborde sur sa photo sur ordinateur. Ensuite, il faut mieux contextualiser les actions de réservation fictive, alléger l’accueil et rapprocher la preuve réelle et le guide d’installation des décisions du visiteur.

La navigation **Accueil, Séances, Portfolio, Galeries, À propos, Contact** est intentionnelle. [ADR-052](../decisions/ADR-052-showcase-copy-authority.md) et les [recommandations différées](../review-follow-ups.md) précisent que l’accueil explique Cadrora et que les autres pages montrent le résultat obtenu par un photographe. Cet audit conserve ce principe ; il ne propose pas de remplacer le site par une navigation SaaS distincte.

Documents associés : [système visuel](02-design-system.md), [plan de refonte](03-redesign-blueprint.md), [feuille de route](04-implementation-roadmap.md).

## Méthode et limites

- **O — observation** : comportement ou rendu constaté en production avec Chromium, le 2 novembre 2026.
- **S — source** : comportement établi par lecture du dépôt ; sa présence en production n’est pas automatiquement prouvée.
- **R — recommandation** : proposition de conception à mettre en œuvre ultérieurement.
- **H — hypothèse** : impact probable à vérifier auprès de visiteurs ou avec une mesure autorisée. Aucun taux de conversion, gain commercial ou score Lighthouse n’est inventé.

Inspection à 1440 × 1000, 390 × 844 et contrôle ciblé de l’accueil à 320 × 740 pixels CSS. Les vues mobiles sont émulées ; ce n’est pas une validation sur iPhone/Safari ou téléphone physique. FR a été examiné sur les pages publiques ; le passage FR → EN → FR a été exercé sur Séances. Les métadonnées statiques d’accueil ont été vérifiées en FR et EN. Les deux thèmes ont été inspectés sur l’accueil et ses démonstrations. Il ne s’agit pas d’une certification d’accessibilité ni d’une revue exhaustive de sécurité.

Parcours exercés : ouverture/fermeture du menu mobile avec Échap, choix « Nécessaire seulement », accueil → ancre de démonstration → galerie publique → visionneuse → fermeture, ouverture/fermeture d’une séance avec retour du focus, séance → Contact avec conservation de session=wedding, visionneuse avec flèche droite/Échap, écrans de verrouillage privé et entrée de recherche faciale. Aucun message de contact, réservation, changement administrateur ou envoi biométrique n’a été effectué. Le déverrouillage réel, les téléchargements, le résultat de recherche faciale et les opérations administrateur n’ont pas été validés ici.

Deux contrôles hors parcours nominal ont été réalisés : URL inexistante et interruption locale des requêtes de paramètres/catalogue. Dans le second cas, l’accueil reste compréhensible et propose l’installation ; Contact affiche son texte et l’absence de coordonnées compilées. Cela vérifie ce scénario d’échec immédiat, pas une panne de toutes les ressources ni la durée maximale d’une requête bloquée.

## Produit, publics et conversions

| Public | Besoin | Conversion utile | Limite à rendre explicite |
| --- | --- | --- | --- |
| Photographe indépendant évaluant Cadrora | Comprendre le résultat et le niveau d’autonomie | Essayer une galerie, explorer l’administration en lecture seule, consulter le guide | Installation sur son propre compte ; compétences techniques initiales |
| Personne aidant le photographe à installer le site | Évaluer prérequis, maintenance et modèle de déploiement | Lire le guide et préparer une installation | Cadrora n’est pas un service hébergé avec inscription immédiate |
| Client/invité sur une installation de photographe | Trouver sa galerie, consulter ses photos, sélectionner ou télécharger selon les permissions | Réaliser l’action autorisée dans la galerie | Mot de passe éventuel ; recherche faciale facultative |
| Prospect d’un studio installé avec Cadrora | Comprendre l’offre et contacter le photographe | Courriel ou appel direct | Les coordonnées et tarifs de cadrora.com sont des exemples |

Les trois premiers besoins sont soutenus par le [README](../../README.md), les profils et les parcours. Leur poids relatif dans l’audience est **inconnu**. L’absence d’abonnement logiciel ne signifie pas hébergement gratuit illimité. Le dépôt indique une licence **PolyForm Perimeter 1.0.1** ; ne pas substituer « open source sans restriction » à cette désignation. Aucune analyse juridique ou tarifaire actuelle des fournisseurs n’est réalisée ici.

## Inventaire technique et fonctionnel

Versions déclarées dans [package.json](../../package.json), sans proposition de mise à niveau : React 19.3.0, TypeScript 6.0.2 strict, Vite 8.3.0, React Router 7.18.4, TanStack Query 5.103.1, i18next 26.4.2 et react-i18next 17.0.14. Hono 4.13.8 et Zod 4.6.5 encadrent l’API. Embla 8.6 et Swiper 14.3 servent des interactions différentes ; leur coexistence n’établit pas qu’une bibliothèque soit inutile. ONNX Runtime Web 1.30 reste lié à la recherche facultative et zip.js aux téléchargements.

| Couche | État observé dans le dépôt | Conséquence pour la refonte |
| --- | --- | --- |
| Routage | SPA React ; documents marketing localisés statiques ; routes de galeries et administration encadrées par le Worker | Garder les URL, les règles de disponibilité et les métadonnées localisées |
| Profils | Cadrora, Atelier Giulia et profil studio ; sélection à la compilation | Employer les profils pour le contenu distinctif, les composants communs pour les corrections communes |
| État | TanStack Query pour les lectures ; paramètres et catalogue D1 prioritaires | Ne pas contourner les lectures en attente pour montrer une image par défaut |
| Styles | CSS natif, variables sémantiques, composants typés ; aucune bibliothèque de composants externe nécessaire | Faire évoluer les primitives existantes, éviter un second système |
| Médias | ProgressivePhoto ; BrandPhoto pour les assets compilés ; variantes et révisions publiées | Aucun nouvel élément img direct ; garder les dimensions et les barrières de chargement |
| Backend | Un Worker Hono, D1, R2 privé, Vectorize optionnel, maintenance_jobs | Aucun changement d’autorisation, cache privé ou cycle de suppression pour une amélioration visuelle |
| Outils de validation | TypeScript, ESLint, Vitest, Playwright | Étendre seulement les tests pertinents des composants modifiés lors de l’implémentation |

Sources principales : [architecture](../architecture.md), [contrats](../technical/contracts.md), [plan par packages](../implementation-plan.md), [guide public](../technical/public-website.md), [routes](../../src/app/routes/publicRoutes.tsx), [profil Cadrora](../../sites/cadrora/site.ts).

### Pages, composants et parcours existants

| Route | Rôle actuel | Composition réutilisable |
| --- | --- | --- |
| /, /fr/, /en/ | Présenter le logiciel, ses démos et l’installation ; exemples de séances et galeries ; Atelier Giulia en référence | HomePage, DemoExperienceCards, FeaturedSites, PublicEventCards |
| /services et variantes localisées | Catalogue de séances d’exemple ; détails, durées, tarifs, inclusions et Contact contextualisé | PublicPageIntro, ServicePhotoHeader, SessionDetailsModal |
| /portfolio, /portfolio/:slug et variantes localisées | Collections permanentes indépendantes des galeries clients | EditorialGalleryCard, ProgressivePhoto, grille et PhotoViewer |
| /galleries | Annuaire public/protégé activable par le propriétaire | PublicEventCards, InfiniteLoadMore ; aucune photo privée dans la carte verrouillée |
| /about et variantes | Présentation du studio d’exemple | AboutPage, ProgressivePhoto, PublicLayout |
| /contact et variantes | Coordonnées directes, contexte de séance, carte facultative | InfoPage, ServiceAreaMap ; aucun formulaire |
| /privacy et variantes | Informations sur les données, galeries, recherche, carte et choix de mesure | Sommaire à ancres, PublicPageIntro |
| /e/:slug, /e/:slug/photo/:photoId | Galerie et visionneuse ; permissions et états propres à la galerie | GalleryPage, PhotoViewer, FavoriteButton, RetouchButton |
| /e/:slug/find | Consentement, photo locale, recherche de correspondances possibles | FindPage ; aucun téléversement de selfie |
| /admin/* | Gestion du site, séances, portfolio, galeries, import et maintenance | Shell et composants partagés ; revue du code seulement dans cet audit |

Les routes marketing sans préfixe restent compatibles. Les pages optionnelles doivent suivre les réglages du propriétaire. Les identifiants internes event ne justifient pas un changement du vocabulaire « galerie » de l’interface.

### Identité actuelle

Logo multicolore en forme de diaphragme, framboise, crème rosée, encre prune, boutons arrondis et dégradé orange–rose–violet. Titres sans empattement très lourds, grandes introductions, cartes avec coins arrondis et ombres. Le système déclare Inter puis les polices système ; une police déclarée dans la pile ne prouve pas qu’elle soit chargée. Cadrora n’importe pas la Playfair Display locale du profil Atelier.

Les images de démonstration et portraits fictifs illustrent mariages, familles, marques et séances. Leur caractère fictif est annoncé sur plusieurs pages. Le ton mêle explication du produit et simulation du studio. Cette dualité est voulue ; quelques actions ne portent pas encore ce contexte assez près de leur libellé.

### SEO, mesure, formulaires et intégrations

- **O** : /fr/ et /en/ répondent 200 avec titres distincts, canonical propre et alternates FR/EN/x-default dans le HTML initial. robots.txt et sitemap.xml répondent 200. Une URL inconnue répond 404 avec noindex,nofollow.
- **S** : Open Graph, Twitter et Organization JSON-LD existent dans la génération statique et/ou PublicLayout. Les collections publiées peuvent alimenter le sitemap. Les galeries clients restent hors sitemap ; leur non-indexation est un choix de confidentialité, pas un défaut SEO à corriger.
- **O** : le panneau annonce Google Analytics désactivé sur la visite observée. **S** : GoogleAnalytics.tsx charge GA4 seulement après consentement et sur des routes autorisées ; il envoie des pages vues sans query/hash. Aucun suivi spécifique des clics de conversion n’a été identifié dans ce module. Aucun tableau de bord de trafic n’a été consulté.
- **O** : Contact expose tel et mailto avec une mention de démonstration, sans formulaire ni iframe avant action. **S** : carte OpenStreetMap ou Google optionnelle, chargée au clic ; aucun fournisseur de formulaire nécessaire.
- **S** : Turnstile concerne connexion/déverrouillage. Ne pas le déplacer vers la consultation marketing. Les états publics, privés, favoris et retouches restent distincts.

Sources : [PublicLayout](../../src/app/public/PublicLayout.tsx), [GoogleAnalytics](../../src/app/public/GoogleAnalytics.tsx), [Contact](../../src/app/public/InfoPage.tsx), [génération HTML](../../scripts/build/generateLocalizedPages.mjs), [indexation](../../src/server/routes/searchIndex.ts).

## Audit critique priorisé

Sévérité : **élevée** = contenu ou action importante difficile à lire/comprendre ; **moyenne** = friction significative ; **faible** = amélioration de finition. Les priorités P0–P3 de la feuille de route sont des ordres de travail, pas une classification d’incident.

| ID | Localisation et fait | Sévérité / effet utilisateur | Solution proposée |
| --- | --- | --- | --- |
| A01 | O/S — Premier accueil à 390 × 844 : panneau de confidentialité de 464 px, du y≈372 au bas de l’écran, alors que GA est désactivé. Les CTA sont dessous. CSS mobile : hauteur fixe 29rem. | Élevée — première lecture interrompue, action masquée ; impact sur abandon non mesuré | Ajuster le panneau au contenu après résolution des réglages, conserver un état d’attente stable et un accès permanent aux choix. Ne pas activer de mesure implicitement. |
| A02 | O/S — Carte Démo admin : paragraphe #6F6275 sur #23172A, environ 3,00:1 à 15 px. Le thème sombre inverse la carte en surface claire mais garde un texte pâle. | Élevée — explication de la lecture seule peu lisible | Donner à la carte une paire surface/texte sémantique explicite ; supprimer la collision avec la règle générale des paragraphes. Vérifier les deux thèmes. |
| A03 | O/S — Boutons primaires : texte blanc 16 px sur dégradé ; orange #FFB45C ≈1,76:1, rose #E43B9A ≈3,90:1 contre blanc. Ce sont des ratios de couleurs du fond, pas une mesure de chaque glyphe. | Élevée — contraste non uniforme et zones trop claires sous les libellés | Utiliser le framboise uni #A72F75 avec blanc, ≈6,35:1. Garder le dégradé dans le logo ou un décor sans texte. |
| A04 | O/S — /fr/about à 1440 px : titre 100,8 px ; le mot « présentation » s’étend jusqu’à x≈788, la photo commence à x≈763. Aucun débordement global du document n’est détecté malgré ce chevauchement. | Élevée — titre visuellement coupé par la photo, impression de mise en page inachevée | Réduire l’échelle dans la colonne, élargir la zone utile et prévoir la rupture des mots longs ; tester le contenu FR réel, EN et zoom. |
| A05 | O — À propos propose « Réserver ma séance » ; la modale propose « Parlons de votre séance » ; Contact explique ensuite qu’aucune réservation n’est possible. | Moyenne — faux espoir de réservation ou confusion avec un studio réel | Garder les destinations de démonstration, mais employer « Voir la page Contact d’exemple » et un contexte local au profil showcase. Conserver les CTA commerciaux des vrais studios. |
| A06 | O — « Créer mon site » descend vers #installation ; le lien qui promet le guide ouvre la racine du dépôt GitHub. Les prérequis sont dans un paragraphe dense. | Moyenne — effort et prochaine étape insuffisamment prévisibles | Nommer l’étape « Voir l’installation », présenter trois étapes et lier directement le guide existant. Expliquer compte propre, coûts variables et aide technique initiale. |
| A07 | O/S — Huit séances d’exemple se répètent sur l’accueil et la page dédiée ; l’explication portfolio → livraison et Atelier Giulia arrivent après. | Moyenne — preuve produit et crédibilité tardives ; impact commercial hypothétique | Remonter le parcours et le site réel ; sélection éditoriale courte de séances seulement pour Cadrora, catalogue complet conservé. |
| A08 | O — À 390 px, après fermeture du panneau, les CTA sont visibles à y≈606–650 mais la photo commence près du bas de l’écran. À 320 px, les CTA tiennent en largeur et restent 44 px hauts. Le nom Cadrora est masqué dans la barre mobile. | Moyenne — premier écran très textuel et marque peu identifiable hors logo | Raccourcir le texte, garder une action nette, rendre le nom visible si l’espace le permet ; faire commencer une preuve visuelle plus tôt sans forcer toute la page à tenir dans un écran. |
| A09 | O/S — Palette cohérente, mais halos roses, ombres du header, boutons dégradés et ornements des cartes s’additionnent. | Faible — la décoration concurrence les photos ; jugement de design | Fond crème stable, ombres réservées aux surfaces flottantes, accent framboise concentré sur les actions. |
| A10 | O/S — Quatre démos disponibles ; IA et galerie publique ont chacune un bouton primaire. L’IA demande d’enregistrer un portrait puis de le sélectionner. | Moyenne — plusieurs décisions et manipulation de fichier pour une première expérience | Conserver l’IA comme démo vedette conformément au guide ; ajouter une entrée claire vers la galerie sans recherche. Étudier ensuite un bouton de portrait d’exemple dans le navigateur, toujours après consentement. |
| A11 | O — Un site réel, Atelier Giulia, est présenté en fin de page sous un titre pluriel. Pas de témoignages vérifiables collectés dans cet audit. | Moyenne — preuve concrète peu visible ; pluriel disproportionné par rapport à la carte unique | Remonter cette carte et utiliser un titre singulier. Présenter un cas réel avec contenus autorisés, sans inventer satisfaction, audience ou revenu. |
| A12 | O/S — La description de la carte privée dans /galleries contient le mot de passe de démonstration. Le guide public réserve cette information à l’écran de déverrouillage. | Faible — encombrement et incohérence éditoriale ; ce mot de passe public n’est pas un secret de client | Corriger uniquement la copie de seed Cadrora connue ; garder l’aide sur l’écran de déverrouillage et ne pas toucher aux galeries privées réelles. |
| A13 | S/O — Pas de lien d’évitement dans PublicLayout ; la visionneuse expose les noms de fichiers comme noms accessibles. Menu Échap et restitution de focus de la modale fonctionnent dans les essais. | Moyenne — navigation répétitive au clavier, noms parfois peu parlants ; lecteur d’écran non testé | Ajouter un lien « Aller au contenu » partagé et des noms d’action contextualisés ; conserver le nom de fichier lorsqu’il aide au travail sur les photos. |
| A14 | S — L’accueil standard attend les réglages puis la disponibilité visuelle du hero. Les métadonnées ont un délai de 15 s ; FirstFrameReveal propose une récupération après 30 s. | Moyenne — risque de longue attente en réseau lent, non quantifié ici | Mesurer le premier rendu utile ; étudier un texte/navigation disponibles sans monter une image provisoire. Préserver impérativement l’autorité des images du propriétaire. |
| A15 | S/O — SEO localisé déjà solide ; Sessions/About restent des exemples et Contact n’est pas un support produit. Les choix d’installation, licence et maintenance sont dispersés entre page et dépôt. | Moyenne — hésitation avant adoption, intentions de recherche partiellement couvertes | Ajouter sur Home une FAQ courte fondée sur les guides, des liens profonds et une fin de parcours explicite. Aucun avis, note ou établissement fictif en données structurées. |
| A16 | S/O — GA désactivé dans cette visite ; pas de baseline de conversion disponible. | Moyenne — impossible d’attribuer un gain à une nouvelle hiérarchie | Commencer par des tests de compréhension ; définir ensuite un plan de mesure facultatif des clics marketing sans données de galerie, sous consentement existant. |

Les critères de lisibilité sont fondés sur les explications W3C : [contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) et [redistribution du contenu](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Les 44 px sont une règle plus exigeante propre à ce dépôt ; le [minimum WCAG 2.2 pour les cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) est de 24 px avec exceptions.

### Couverture des douze axes demandés

| Axe | Conclusion / références |
| --- | --- |
| Première impression et professionnalisme | Identité reconnaissable, mais défaut About et décor chargé : A04, A09 |
| Proposition en cinq secondes | Site photo compris ; modalités d’installation à rendre plus immédiates : A06, A08 |
| Hiérarchie et ordre | Démo tôt, preuves et explication métier tard : A07, A11 |
| Typographie, espace, contraste | A01–A04, A08 ; corps de texte généralement lisible hors carte inversée |
| Cohérence des composants | Primitives déjà partagées ; collision de styles et boutons à corriger : A02, A03 |
| Navigation et architecture | Navigation à préserver ; mieux contextualiser la démonstration : A05, A15 |
| Appels à l’action | A01, A05, A06, A10 |
| Imagerie | Photos présentes et progressives ; preuve du logiciel plus explicite souhaitable : A08, A09 |
| Confiance et preuve | Mention des images fictives utile ; cas réel trop tardif : A11, A12 |
| Responsive et mobile | Pas de débordement horizontal dans les pages mobiles inspectées ; panneau et densité : A01, A08 |
| Accessibilité et retours | Modales/menu utilisables dans les essais ; contrastes et évitement : A02–A04, A13 |
| Friction des conversions | Installation, réservation fictive, essai IA et mesure : A05, A06, A10, A16 |

## Recherche comparative : trois références pertinentes

Sites de logiciels pour photographes, plutôt que trois studios : c’est le bon groupe pour l’adoption de Cadrora. Pages officielles consultées et rendues sur ordinateur/mobile le 2 novembre 2026. Les descriptions ci-dessous sont des observations de présentation ; les arguments commerciaux des éditeurs ne constituent pas des performances vérifiées. Aucun compte, paiement ou essai complet n’a été créé.

| Référence | Langage visuel et structure | Navigation, conversion et confiance | Mobile observé | Occasion pour Cadrora |
| --- | --- | --- | --- | --- |
| [Pixieset](https://pixieset.com/) | Hero photo montrant une galerie sur tablette ; sans empattement ; action turquoise. Suite de sections galerie, produits, preuve et usages. | Produits, exemples, prix ; même invitation de démarrage dans le header et le hero. Affiche métriques et témoignages propres à l’éditeur. | Titre empilé, CTA large et navigation repliée ; aucun débordement horizontal au viewport testé. Capture reprise après animation d’entrée. | Montrer le logiciel dans une situation réelle et offrir un essai immédiat, sans reprendre les chiffres ou la promesse de croissance de Pixieset. |
| [Pic-Time](https://www.pic-time.com/fr) | Fond ivoire, titre serif ample, boutons noirs ; galerie de photos éditoriale. Suit avec bénéfices, exemples, témoignages et vente de tirages. | Liens produits, exemples de galeries, ressources, tarifs ; CTA de démarrage répété. L’esthétique constitue une partie de la preuve. | Hero centré, bouton avant la mosaïque, menu compact ; pas de débordement horizontal observé. | Donner aux photos davantage de calme et d’espace ; conserver une phrase explicite sur l’hébergement, plus concrète qu’un slogan seul. |
| [Zenfolio](https://zenfolio.com/) | Interfaces produit et photographies, crème/orange, titres serif ; alternance de capacités et preuves. | Menu fonctions/publics/modèles/prix ; essai gratuit et réassurance près du CTA ; avis et références affichés. | Visuel produit au-dessus du texte ; CTA et réassurance visibles dans le premier écran testé ; menu replié. | Mettre une preuve exploitable près de l’action ; éviter les promotions et promesses de commerce/booking que Cadrora ne fournit pas. |

Ces trois pages montrent clairement le produit, son public et une prochaine action. **H** : Cadrora peut être plus convaincant pour un public qui privilégie son propre hébergement en associant démonstration sans compte, prérequis honnêtes et explications de confidentialité. Cet avantage reste une hypothèse de positionnement, pas une supériorité mesurée. La recherche IA seule n’est pas une différenciation unique : Pic-Time la présente également.

## Preuves visuelles

Les captures sont des constats avant modification, pas des maquettes proposées. Les concurrents sont conservés comme références d’audit, sans autorisation de réutiliser leurs photographies dans le site.

- [Accueil bureau, première visite](evidence/cadrora/cadrora-home-desktop-initial.png)
- [Accueil mobile, panneau présent](evidence/cadrora/cadrora-home-mobile-initial.png) et [après fermeture](evidence/cadrora/cadrora-home-mobile-dismissed.png)
- [Démonstrations, thème clair](evidence/cadrora/cadrora-demo-desktop.png) et [sombre](evidence/cadrora/cadrora-demo-dark-desktop.png)
- [À propos bureau : chevauchement](evidence/cadrora/cadrora-fr-about-desktop.png)
- [Détails d’une séance mobile](evidence/cadrora/cadrora-session-dialog-mobile.png)
- [Pixieset bureau](evidence/cadrora/pixieset-desktop.png) / [mobile](evidence/cadrora/pixieset-mobile.png)
- [Pic-Time bureau](evidence/cadrora/pictime-desktop.png) / [mobile](evidence/cadrora/pictime-mobile.png)
- [Zenfolio bureau](evidence/cadrora/zenfolio-desktop.png) / [mobile](evidence/cadrora/zenfolio-mobile.png)

## Validations du dépôt

Résultats de cette phase documentaire :

| Commande | Résultat |
| --- | --- |
| npm run check | Réussi : TypeScript et ESLint |
| npm run test | 103 fichiers réussis, 1 en échec ; 534 tests réussis, 4 délais dépassés à 5 s dans remoteSecrets.test.mjs, 1 ignoré |
| npm run test -- tests/unit/scripts/remoteSecrets.test.mjs --testTimeout=20000 | Réussi : 10 tests, 1 ignoré |
| npm run test -- --testTimeout=20000 | Réussi : 104 fichiers, 538 tests, 1 ignoré |
| npm run build | Non lancé : aucun changement runtime, routage, configuration ou dépendance |
| npm run test:e2e | Non lancé : inspection ciblée en production via Playwright ; aucune implémentation à valider |

Le second passage a augmenté le délai en ligne de commande seulement. Il ne transforme pas le premier résultat en succès et ne prouve pas la cause des lenteurs. Le code de test et sa configuration restent inchangés. Les contrôles Git et des liens documentaires sont consignés dans la [feuille de route](04-implementation-roadmap.md).
