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

## Couverture actuelle

- site vitrine en bureau et mobile, y compris la panne de l'API des galeries;
- navigation canonique `/galleries` et vocabulaire galerie;
- contact configure par variables publiques, sans formulaire et sans requete vers un domaine externe;
- redirection Worker de `/admin` vers `/admin/login` sans session;
- demo admin en lecture seule avec multi-selection des langues, theme, options IA, publication et suppression visibles mais sans ecriture;
- galerie publique, ouverture/fermeture de la visionneuse et galerie protegee avec echange de mot de passe;
- selection de plusieurs photos, Maj+clic, Ctrl+A, explication des photos non telechargeables, creation du ZIP, enregistrement direct dans le dossier choisi simule et protection des noms existants, refus d'un dossier sensible puis repli ZIP, et style commun des liens retour (galerie, recherche, contact);
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
