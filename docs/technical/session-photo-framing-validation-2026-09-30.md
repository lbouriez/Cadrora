# Session photo framing validation - 2026-09-30

## Integration into local main

The feature was merged with local main's newer Atelier Home slider, footer, and gallery Escape fix. The merge keeps `VerticalStorySlider` and the final-slide footer behavior. With no focal choice, image CSS retains the existing `object-fit: cover` and centered crop; focal CSS applies only for an explicit left/right default or a phone override. On `http://127.0.0.1:4290/`, the first slide at 944×900 and 390×900 kept `object-position: 50% 50%` and a settled visual scale of 1. This local demo uses its own older service records and bundled wedding image, so it cannot confirm the production Maternity portrait.

- `npm run check` passed.
- `npm run test` passed: 82 files, 348 tests.
- `$env:CADRORA_SITE='atelier-giulia'; npm run build` passed.
- `$env:CADRORA_SITE='cadrora'; npm run build` passed.
- `npx wrangler d1 migrations apply DB --local` applied migrations 040 and 041 to the root checkout's local D1.
- `$env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/service-photo-site-profile.spec.ts --workers=2` passed: 4 desktop/phone tests, including the unchanged default crop.
- `$env:CADRORA_SITE='cadrora'; npx playwright test tests/e2e/service-photo-site-profile.spec.ts --workers=2` passed: 4 desktop/phone tests.
- `$env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/site-profile.spec.ts tests/e2e/service-photo-site-profile.spec.ts --workers=2` passed: all 28 tests, matching CI's two-worker setting.
- `$env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/service-photo-site-profile.spec.ts tests/e2e/site-profile.spec.ts` passed 27 of 28 tests under 16 parallel workers. The mobile strong-gesture test advanced an extra slide in that run; `$env:CADRORA_SITE='atelier-giulia'; npx playwright test tests/e2e/site-profile.spec.ts --grep 'even strong wheel or finger gestures' --project=mobile-chromium --workers=1` passed in isolation. This intermittent gesture result is distinct from image framing.

The following evidence was gathered on the original focal-point feature branch before integration.

Feature branch: `codex/session-photo-focal-point`, based on remote main `472ca1958b82232915921c16ddec4f295ce09597`.

## Passed

- `npm run check` - strict TypeScript and ESLint passed.
- `npm run test` - 82 files, 348 tests passed.
- `npm run test -- tests/unit/server/serviceRoutes.test.ts tests/unit/app/serviceCatalogEditor.test.tsx` - 16 focused tests passed, including owner-only writes, persistence, omitted-field preservation, explicit phone-override removal, reset, and FR/EN editor save/reload.
- `npm run build` - Cadrora build passed.
- `$env:CADRORA_SITE='atelier-giulia'; npm run build` - Atelier build passed.
- `npx wrangler d1 migrations apply DB --local` - all migrations through 041 applied successfully to the isolated local database.
- `npx wrangler d1 execute DB --local --command "SELECT id, photo_alignment, mobile_photo_alignment FROM site_services WHERE id = 'maternity'"` - existing Maternity row has center/null defaults.
- `$env:CADRORA_SITE='atelier-giulia'; $env:CADRORA_E2E_PORT='4187'; npm run test:e2e -- tests/e2e/service-photo-site-profile.spec.ts --workers=1 --output=C:/Users/tanlbou/AppData/Local/Temp/cadrora-framing-reviewed` - four desktop/phone tests passed.
- `$env:CADRORA_SITE='cadrora'; $env:CADRORA_E2E_PORT='4187'; npm run test:e2e -- tests/e2e/service-photo-site-profile.spec.ts --workers=1 --output=C:/Users/tanlbou/AppData/Local/Temp/cadrora-framing-showcase` - four desktop/phone tests passed.
- `git diff --check` - passed.

Visual review covered the actual phone preview in FR and EN, including the image crop, title, description, booking label, small-frame typography, and absence of horizontal overflow. Browser tests verify both progressive image layers, desktop/phone overrides, inheritance, phone widths of 320/390 pixels, and saving/reopening without another image upload. Generated geometric images are used as fixtures; no real portraits are committed.

## Existing baseline failures

`$env:CADRORA_SITE='atelier-giulia'; $env:CADRORA_E2E_PORT='4187'; npm run test:e2e -- tests/e2e/site-profile.spec.ts --workers=2 --output=C:/Users/tanlbou/AppData/Local/Temp/cadrora-framing-profile-regression` passed 22 of 24 tests. Two desktop tests failed: strong wheel gestures and reduced-motion gestures expected document `scrollY=0`, but received 77.

Both failures were reproduced in a separate untouched worktree at remote main `472ca1958b82232915921c16ddec4f295ce09597` with:

`$env:CADRORA_SITE='atelier-giulia'; $env:CADRORA_E2E_PORT='4191'; npm run test:e2e -- tests/e2e/site-profile.spec.ts --project=desktop-chromium --grep='even strong|reduced motion' --workers=1 --output=C:/Users/tanlbou/AppData/Local/Temp/cadrora-framing-baseline`

The same two tests failed with the same `scrollY=77` result. This feature does not include the unrelated local slider commits or edits.

## Boundaries

Production deployment, remote D1 migration, production owner-save, real Cloudflare authentication/media storage, and iPhone Safari validation were not run. Local build/dev commands warn about absent local auth secrets and unsupported local Vectorize; API authorization and image delivery have focused unit/browser evidence rather than provider-backed release evidence. Apply migration 041 before releasing the Worker.
