# Tests end-to-end Playwright

Last reviewed: 2026-09-21.

## Objectif

La suite `tests/e2e/` valide les parcours visibles qui peuvent rester deterministes sur un poste de developpement sans compte Cloudflare. Elle demarre le serveur Vite/Worker local sur `127.0.0.1:4178` et execute Chromium avec deux projets : bureau (1440 x 900) et mobile Pixel 7 pour le site vitrine.

## Commandes

```powershell
npm run test:e2e:install
npm run test:e2e
```

`npm run test:e2e:headed` ouvre Chromium pour une inspection locale. En cas d'echec, Playwright conserve une capture, une trace et une video sous `test-results/`; le rapport HTML est produit en CI sous `playwright-report/`. Ces dossiers ne sont pas versionnes.

Pour executer plusieurs validations locales en parallele, definir `CADRORA_E2E_PORT` sur un port libre. Garder les artefacts personnalises hors du depot avec `--output` : Vite peut tenter de surveiller les videos Playwright creees dans un dossier du projet sur Windows.

## Couverture actuelle

### Premier rendu du build de production

Le serveur de developpement ne contient pas le HTML localise genere apres le build. La suite ciblee `startup-build.spec.ts` utilise donc `vite preview` pour verifier le premier affichage : JavaScript retarde puis libere, couleurs du profil, FR/EN, bureau/mobile, API indisponible et navigation au clavier sans JavaScript.

Sur Atelier Giulia, elle retarde separement le JavaScript et le CSS du slider, les parametres, la grande photo et la police. Des mesures a chaque frame verifient que la photo conserve le meme noeud DOM et que sa premiere apparition comprend le texte et les points de navigation. Elle couvre aussi les echecs de photos et de chargement du slider. Les seuls etats finaux et captures apres stabilisation ne suffisent pas a detecter un remontage du premier slide.

```powershell
$env:CADRORA_SITE = 'atelier-giulia'
$env:VITE_APP_NAME = 'Atelier Giulia'
npm run build
$env:CADRORA_E2E_BUILD = 'true'
npx playwright test startup-build.spec.ts --workers=2
Remove-Item Env:CADRORA_E2E_BUILD
```

Repeter avec `CADRORA_SITE=cadrora` et `VITE_APP_NAME=Cadrora`. Le profil choisi doit correspondre au build sur disque. Ces tests sont ignores en mode developpement. Ils ne valident pas un deploiement distant.

### Parcours applicatifs

- site vitrine en bureau et mobile, y compris la panne de l'API des galeries;
- navigation canonique `/galleries` et vocabulaire galerie;
- contact configure par variables publiques, sans formulaire et sans requete vers un domaine externe;
- redirection Worker de `/admin` vers `/admin/login` sans session;
- demo admin en lecture seule avec multi-selection des langues, theme, options IA, publication et suppression visibles mais sans ecriture;
- galerie publique, ouverture/fermeture de la visionneuse et galerie protegee avec echange de mot de passe;
- selection de plusieurs photos, Maj+clic, Ctrl+A, explication des photos non telechargeables, creation du ZIP, enregistrement direct dans le dossier choisi simule et protection des noms existants, refus d'un dossier sensible puis repli ZIP, et style commun des liens retour (galerie, recherche, contact);
- mosaique et visionneuse sur ordinateur et largeur telephone, cartes entieres cliquables, couverture privee generique, et choix de retouche distinct du coeur dans une galerie protegee;
- reprise observable d'un journal IndexedDB de 200 entrees decoupe en quatre lots de 50 : les deux premiers lots sont finalises, l'UI affiche `100/200` et la prochaine declaration reprend au lot 2 avec 50 photos;
- rejet d'un fichier non image;
- consentement face-search, selection locale d'une image et absence de requete face-search avant l'analyse.

Les donnees de galerie et les reponses des APIs admin sont simulees au niveau reseau du navigateur. Le stub Turnstile est strictement local et fournit un jeton fictif. Le scenario de reprise utilise le vrai IndexedDB du navigateur, mais interrompt volontairement le prochain appel de declaration avant l'encodage en masse. Ces tests verifient donc le contrat et l'integration UI, mais **pas** D1, R2, Vectorize, la validation Cloudflare Turnstile reelle, l'encodage complet de 200 vraies photos, les modeles ONNX ou un deploiement Cloudflare.

Le test unitaire `tests/unit/app/importPipeline.test.ts` complete cette couverture avec le vrai orchestrateur : 200 fichiers synthetiques, quatre lots de 50, interruption apres 100 finalisations, puis reprise des seuls deux lots restants au moyen d'un nouveau pipeline et du meme journal en memoire. Les encodeurs et APIs y sont des fakes deterministes; un environnement de preproduction avec de vrais bindings et des photos representatives reste requis avant une release.

## Regles d'ecriture

- garder les reponses simulees conformes aux schemas Zod partages;
- ne jamais contourner l'interface pour les assertions fonctionnelles, sauf pour amorcer IndexedDB ou une navigation SPA explicitement documentee;
- verifier les resultats visibles, pas seulement les appels reseau;
- ne pas inclure de secret, de portrait reel ou de donnee biometrique dans les fixtures;
- ajouter un projet ou un test cible plutot que ralentir toute la matrice pour une seule capacite optionnelle.

Session HTML is now Worker-gated by the D1 page-availability flag. Before starting browser tests on a fresh checkout, run `npx wrangler d1 migrations apply cadrora --local`. Browser API mocks do not initialize or bypass that Worker-side D1 read. The Atelier production verification job applies these local migrations before its desktop/phone suite and includes the public-page visibility regressions. During a mocked settings outage, optional page links must remain hidden; restore an enabled response before testing menu navigation.

The Sessions route and shared public shell disable automatic retry-on-mount for a failed settings query. Mounting the compiled fallback must not restart the same failed query and cycle back to the loading shell; explicit query invalidation still permits a refresh. The profile outage test covers this fallback on desktop and phone.
