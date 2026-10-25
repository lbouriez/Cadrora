# Review fixes — 2026-10-25

## Implemented scope

- Keep gallery cleanup statements within D1's bound-parameter limit, and load portfolio variants in bounded queries for the supported 200-photo catalog.
- Include portfolio variants in storage reconciliation; correct the SQLite faces-counter UPSERT parsing ambiguity found by real-SQL regression tests.
- Keep each protected gallery's signed access cookie independent, while retaining legacy-cookie compatibility, expiry, access-version revocation and media authorization.
- Separate photo-upload success from text-save success. Preserve unsaved About/session text during internal navigation in tab memory, warn before document exit, and clear drafts on save or confirmed session loss/change.
- Exclude hidden/inert controls from modal keyboard boundaries, preserve nested-modal isolation, and respect Atelier's reduced-motion preference.
- Keep gallery download controls visible below the actual header, with primary download actions first and bounded scrolling on short screens.
- Keep Cadrora's existing demonstration structure. Make its descriptions/footer repository-owned when the explicit showcase gate is enabled, preserving page-specific metadata. Ordinary sites retain their existing saved-setting precedence.
- Correct the reviewed FR/EN copy. Atelier migration 045 matches its site identity and exact previous field values, preserving newer owner edits. The Cadrora showcase seed independently repairs its known old description/footer fields.

The larger recommendations and their current implementation status are tracked in [review-follow-ups.md](review-follow-ups.md).

## Validation

Commands ran from the repository root in PowerShell. Browser tests use local rendering with mocked HTTP fixtures; they are not production/provider or physical-device proof.

| Command | Result |
| --- | --- |
| `npm run check` | Passed: strict typecheck and lint. |
| `npm run test` | Final standalone run: 100 files passed, 501 tests passed, one existing POSIX-only test skipped on Windows. An earlier concurrent run timed out in an unchanged remote-secrets test; the unchanged test passed in the standalone full run. |
| `npm run build` | Passed for Cadrora. |
| `$env:CADRORA_SITE='atelier-giulia'; npm run build` | Passed for Atelier. |
| `npx wrangler d1 migrations apply DB --local --persist-to .artifacts/review-2026-10-25/d1` | Migrations 001–045 applied successfully to an isolated local D1 database. |
| `$env:CADRORA_E2E_PORT='4281'; npx playwright test tests/e2e/public-website.spec.ts tests/e2e/showcase-copy-site-profile.spec.ts --workers=2 --output=test-results-cadrora-review` | 38 passed initially; two old heading expectations failed after intentional copy changes. Expectations were updated and both cases passed in the targeted command below. |
| `$env:CADRORA_E2E_PORT='4281'; npx playwright test tests/e2e/public-website.spec.ts --grep 'relie les services' --workers=2 --output=test-results-cadrora-copy-recheck` | 2 passed. |
| `$env:CADRORA_E2E_PORT='4281'; npx playwright test tests/e2e/metadata-site-profile.spec.ts --workers=2` | 4 passed: FR/EN on desktop/mobile, including conflicting saved metadata/footer fixtures. |
| `$env:CADRORA_E2E_PORT='4283'; $env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/metadata-site-profile.spec.ts --workers=2` | 4 passed: Atelier retains its saved descriptions, footer and service-area behavior. |
| `$env:CADRORA_E2E_PORT='4282'; npx playwright test tests/e2e/ux-audit-site-profile.spec.ts --workers=2` | 6 passed: keyboard focus, sticky selection, About editing/upload/navigation. |
| `$env:CADRORA_E2E_PORT='4283'; $env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/ux-audit-site-profile.spec.ts tests/e2e/site-profile.spec.ts --grep 'narrow photo viewer\|download actions remain\|About text remains\|respects reduced motion' --workers=2` | 8 passed, including reduced-motion wheel/touch/keyboard behavior. |
| `npx playwright test tests/e2e/ux-audit-site-profile.spec.ts --grep 'download actions remain' --workers=2` | Final toolbar ordering rerun: 2 passed per profile, with the corresponding profile/port environment settings above and output directories `.artifacts/ux-cadrora-final` and `.artifacts/ux-atelier-final`. Screenshots inspected. |
| `git diff --check` | Passed. Existing line-ending warnings only. |

Initial tests also identified an outdated maternity-copy assertion and a missing JSON import attribute in the new metadata test; both were corrected before the successful final runs.

## Release boundary

No commit, push, deployment or remote database mutation was performed. The saved Atelier copy changes require deployment of migration 045; the Cadrora saved-copy repair requires its normal showcase seed step. Local development reported missing local AUTH_PEPPER and unavailable local Vectorize bindings, so the browser runs do not establish live authentication/provider behavior. Server authorization and database regressions were covered by the automated suite.

Existing unrelated setup/Node-version/workflow changes were preserved.

## Maintenance workspace follow-up

The owner-authorized workspace adds overview, background jobs, application logs and the existing manual media inventory under `/admin/maintenance`. Sections are independently mounted and use shared FR/EN resources. Existing upload recovery remains in the gallery flow. The typed logger persists classified HTTP errors, job failures and scheduled-run outcomes to D1; it does not capture arbitrary browser/provider logs. Logs and run history expire after 90 days, with bounded cleanup through the existing scheduled trigger. See [the maintenance guide](technical/maintenance.md) and [ADR-053](decisions/ADR-053-owner-maintenance-and-application-log.md).

| Command | Result |
| --- | --- |
| `npm run check` | Passed: strict typecheck and lint. |
| `npm run test` | 102 files passed; 512 tests passed, one existing platform-specific test skipped. An obsolete console-label expectation was updated for the new structured logger before this passing run. |
| `npm run build` | Passed for Cadrora after final UI changes. |
| `$env:CADRORA_SITE='atelier-giulia'; npm run build` | Passed for Atelier after final UI changes. |
| `npx wrangler d1 migrations apply DB --local --persist-to .artifacts/review-2026-10-25/d1` | Migration 046 applied successfully to the local database. |
| `$env:CADRORA_E2E_PORT='4286'; npx playwright test tests/e2e/maintenance-site-profile.spec.ts --workers=2 --output=.artifacts/maintenance-cadrora-complete` | 8 passed: FR/EN, desktop/mobile, section navigation, filters, manual scans, demo denial and unavailable-data handling. Screenshots inspected. |
| `$env:CADRORA_SITE='atelier-giulia'; $env:CADRORA_E2E_PORT='4287'; npx playwright test tests/e2e/maintenance-site-profile.spec.ts --workers=2 --output=.artifacts/maintenance-atelier-complete` | 8 passed for the Atelier profile. |
| `git diff --check` | Passed; existing line-ending warnings only. |

These browser checks use mocked HTTP responses. Deployment requires migration 046 before serving the new Worker; live Cron execution, hosted access and provider failure behavior have not been verified in this local change. No commit, push, deployment or remote database mutation was performed.
