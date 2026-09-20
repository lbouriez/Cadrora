# Testing and validation

Vitest owns deterministic unit and integration coverage. Playwright owns the browser-level desktop/mobile journeys described in [`e2e-testing.md`](e2e-testing.md). Tests must not require production credentials or mutate remote Cloudflare resources.

## Commands

```powershell
npm run check
npm run test
npm run build
npm run setup -- --diagnose
```

`npm run setup` may be used to validate the local D1 migration. It must remain idempotent and preserve existing local data.

## Test ownership

- `tests/unit/server/`: schemas, middleware, services, and repositories with mocked boundaries.
- `tests/unit/app/`: reusable UI behavior and accessibility.
- `tests/e2e/`: browser journeys against a dedicated test environment.
- `tests/fixtures/`: deliberately non-private sample images and EXIF cases.

There is currently no provider-backed `tests/integration/` suite. D1/R2/Vectorize behavior is covered at typed/mocked boundaries locally and must be exercised in an isolated Cloudflare preview before release; add that directory only when it runs against genuinely isolated provider state.

Prefer behavior assertions over internal implementation details. Cursor, idempotency, auth, cache, metadata stripping, and deletion tests are contract tests and should fail loudly when a contract drifts.

The shared controls have focused rendered tests for labels, error associations, keyboard tabs, modal-like Escape behavior, and confirmation actions. Keep component tests independent of feature translations by passing translated labels as props, as production screens do.

Before handoff, run `git diff --check` and inspect `git status --short`. Never describe an in-progress, skipped, or unrelated CI result as validation of the current commit.
