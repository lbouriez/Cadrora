# Production-readiness review — 2026-09-23

This is a point-in-time source and local-browser review, not certification of a deployed Cloudflare revision. The reviewed public routes were `/`, `/services`, `/galleries`, `/contact`, `/privacy`, a public gallery, and its face-search entry; the admin routes were demo login, gallery dashboard, site settings, and gallery settings. Desktop live pages were inspected and local browser tests covered desktop/mobile behavior.

## Verified locally

- Shared tokens and controls are used across public and admin routes. The gallery dashboard now presents existing work before creation; availability precedes permanent deletion; site limits have their own anchored section. Demo controls remain explorable while write actions are disabled and server-side read-only rejection remains covered by tests.
- Runtime contact, map radius, services, theme, language, and analytics settings are read from D1 through `/api/v1/site`. The static public website retains compiled fallbacks if that API fails; configured empty contact fields intentionally hide their corresponding item. The current public site API returned a 125 km map radius, rather than a hardcoded Contact-page value.
- Visitor-facing privacy and face-search copy is available in FR and EN. The finder shows the generated test portraits as visual download cards, explains that the selfie stays local and that a mathematical signature is sent, and requires consent before analysis/search.
- `npm run check`, `npm run test`, `npm run build`, full Playwright E2E, and `npm audit --audit-level=high` are release gates for this change. Record their actual outcomes with the revision; rerun after any subsequent edit.
- The build script strips local development-variable files copied into the Vite Worker output. No secret value was printed in this review. Verify the artifact again before distribution.
- Unhandled Worker errors now log only a fixed category and request ID, because exception messages from external services may contain private keys or payload fragments. The response remains a generic 500 API error.

## Not yet proven for a production release

1. A fresh, unrelated Cloudflare account deployment, including real D1/R2/Vectorize bindings, secrets, DNS, migrations, and rollback/restore rehearsal.
2. A real interrupted 50/200-photo import with representative files, followed by browser restart and recovery. Local tests use deterministic fixtures and mocks.
3. Face-search inference and camera capture on iPhone Safari, including consent, model loading, and no-match behavior. Local Chromium cannot substitute for this device check.
4. Exact deployed-revision smoke tests on the custom domain, preview hostname, and `workers.dev`: public/static fallback, protected media denial, admin denial, downloads, analytics consent, map opt-in, maintenance Cron, and R2/Vectorize cleanup after removal.
5. Operator backup, tested restore/rollback, monitoring, and incident ownership. The repository documents the maintenance path but cannot prove account-level recovery or alerting.

The above gaps remain release-acceptance work. Do not describe the whole project as production-ready solely because source checks and browser mocks pass. See [`../operations.md`](../operations.md), [`../implementation-plan.md`](../implementation-plan.md), and [`e2e-testing.md`](e2e-testing.md).
