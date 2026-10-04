# Cadrora marketing rendering experiment, 2026-10-03

## Decision

Keep this implementation on an experimental branch. It preserves the complete first frame and improves local startup, but does not meet ADR-049's mobile median-100 acceptance gate. It is not a production release or evidence that Worker rendering alone reaches the target.

The prototype renders Home and Sessions from one validated public D1 snapshot, hydrates the existing components, and retains the one-second reveal. Priority images retain the same DOM nodes and full responsive sources. Inline startup styles protect the identity when the full stylesheet is late or fails. No image quality reduction, dependency, HTML cache, database migration or production routing change is included.

## Measurement boundaries

Baseline: the retained Cadrora client build from `c71826c7fe09250b2ec0889d79037abe0cde2b6d`. Candidate: the final experimental client with native responsive first-frame photos and critical startup CSS. Lighthouse 13.5.0, Chrome 154, default simulated mobile throttling and the desktop preset, fresh Lighthouse browser contexts. Both builds use the same local gzip server, public Cadrora data and cached media responses. Tests and builds were not run concurrently with Lighthouse.

An initial series alternated baseline/candidate for five runs per route/device (40 runs). That earlier candidate still used a blocking stylesheet. After adding the failed/late-CSS protection and removing redundant image measurements, another five runs per route/device measured the final candidate (20 runs). Comparisons below use the baseline from the initial series; the final series was not interleaved with new baseline runs. Results are local observations, not a statistically controlled production comparison.

The benchmark pre-renders the snapshot before serving it. It does **not** measure live Worker CPU, D1 latency, provider caching, real network variability or production TTFB. `Server-Timing` in the actual preview Worker reports elapsed data/render durations, not CPU time.

The local server does not implement the Worker's robots route and returns HTML for `robots.txt`, producing a local SEO score of 92. That score cannot establish a production SEO regression. Accessibility and best-practices category scores are 100; the experimental, unweighted label-content-name audit still flags the pre-existing mobile short CTA labels. A category score is not a complete accessibility certification.

## Local results

Each row represents five cold runs. Timings are medians in milliseconds; CLS was zero in every run.

| Route / device | Build | Performance median (range) | FCP | LCP | TBT |
| --- | --- | --- | ---: | ---: | ---: |
| Home mobile | Baseline | 91 (89–92) | 2103 | 3079 | 124 |
| Home mobile | Final candidate | 95 (94–95) | 903 | 2933 | 76.5 |
| Home desktop | Baseline | 100 (100–100) | 443 | 704 | 0 |
| Home desktop | Final candidate | 100 (100–100) | 383 | 627 | 0 |
| Sessions mobile | Baseline | 92 (91–92) | 2103 | 3154 | 31 |
| Sessions mobile | Final candidate | 95 (95–96) | 903 | 3004 | 38 |
| Sessions desktop | Baseline | 100 (100–100) | 443 | 684 | 0 |
| Sessions desktop | Final candidate | 100 (100–100) | 384 | 604 | 0 |

Final Home mobile scores: 94, 94, 95, 95, 95. Final Sessions mobile scores: 95, 96, 95, 95, 95. All ten final desktop scores: 100. Accessibility/best-practices category scores were 100 for all 20 final runs, with the limitations above.

The earlier blocking-stylesheet candidate had mobile medians of 95 (Home) and 94 (Sessions), with Home FCP 1282 ms and TBT 34 ms. The final candidate paints the identity earlier and survives failed CSS, but more application work falls after FCP (Home TBT 76.5 ms). This is not evidence that every metric improved. Full CSS inlining and full JavaScript preloading were tried and discarded; they did not establish a better equivalent result.

## Verification

- `npm run check`: TypeScript and ESLint passed.
- `npm run test`: 92 files, 434 tests passed.
- `CADRORA_MARKETING_PRERENDER=true CLOUDFLARE_ENV=preview CADRORA_SITE=cadrora CADRORA_SEED_DEMO=true npm run build`: passed.
- With the same flags and `CADRORA_E2E_BUILD=true`, `npx playwright test tests/e2e/marketing-prerender.spec.ts --workers=2`: 17 passed, one mobile case intentionally skipped because its hero is below the first viewport.
- `CADRORA_MARKETING_PRERENDER=false CADRORA_SITE=cadrora CADRORA_SEED_DEMO=true CLOUDFLARE_ENV=preview npm run build`, then `CADRORA_E2E_BUILD=true npx playwright test tests/e2e/startup-build.spec.ts --workers=2`: 26 passed, 26 profile-inapplicable cases skipped.
- `CADRORA_MARKETING_PRERENDER=false CADRORA_SITE=atelier-giulia CADRORA_SEED_DEMO=false CLOUDFLARE_ENV=preview npm run build`, then the same startup suite: 40 passed, 12 profile-inapplicable cases skipped.
- `CADRORA_MARKETING_PRERENDER=true CLOUDFLARE_ENV=production CADRORA_SITE=cadrora npx vite build`: rejected by the expected preview-only guard. The equivalent Atelier preview build is also rejected by the guard.
- `git diff --check`: passed.

Environment assignments above use shell-neutral notation; the Windows runs set `$env:NAME` before each command. The browser server port was 4303. The isolated local preview D1 schema was migrated before browser tests.

The browser checks cover FR/EN Home and Sessions on desktop/mobile, delayed JavaScript, loaded-image node preservation, slow/failed CSS, saved language/theme/consent, navigation/back, direct fragments, session dialogs, slow visible display photos and reduced motion. Existing Atelier tests also delay its slider script, stylesheet, settings, font and display photo independently. Screenshots of the final Cadrora desktop/mobile rendering and the slow-CSS identity were visually inspected. No horizontal overflow or hydration error was observed in those checks.

## Remaining acceptance gates

The final mobile Home LCP element is the heading, not the photograph. The complete first frame still waits for the application to load and hydrate. Further work should measure reducing JavaScript on that critical path; additional photo compression does not address this particular delay. Do not obtain a higher score by removing controls, changing consent or revealing a partially ready page.

Remote preview publication is blocked: the read-only `npx wrangler d1 list --json` recheck returns Cloudflare authentication error 10000 for the Cadrora account. The available Wrangler session grants a different account. No credentials were copied between instances, and no production deployment was performed. A valid Cadrora session and isolated preview resources are required before live D1/Worker CPU/TTFB, preview CSP and publication-mutation checks can be claimed. Revision-fenced HTML caching remains unimplemented and must be tested before any cache is introduced.

Local raw JSON/HTML Lighthouse reports, command logs and screenshots are retained under `.artifacts/marketing-prerender/` (ignored, not published with the repository). `paired-*` identifies the initial comparison; `final-*` identifies the retained candidate. The experiment scripts and fixture server are in that same local artifact directory. See [ADR-049](../decisions/ADR-049-marketing-prerender-proposal.md) for the adoption contract.
