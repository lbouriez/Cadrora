# Engineering documentation index

This directory contains enduring implementation rules for humans and coding agents. It is not a product backlog and must not contain secrets or local credential values.

Last reviewed: 2026-09-21.

## Source-of-truth order

When two sources disagree, use this order and repair the lower-authority source in the same change:

1. Executable source and tests.
2. Manifests, `wrangler.jsonc`, migrations, and CI workflows.
3. Frozen contracts and accepted ADRs.
4. Engineering guides.
5. Implementation plans, drafts, and historical notes.

The approved contracts cannot be changed merely because current code differs. Contract changes require an ADR and human validation.

## Route a change

| Change | Read first | Minimum validation |
| --- | --- | --- |
| Worker route, middleware, auth | [`contracts.md`](contracts.md), [`security.md`](security.md) | `npm run check`, `npm run test`, `npm run build` |
| D1 schema or repository | [`../architecture.md`](../architecture.md), migration itself | local migration, tests, check, build |
| React UI or design system | [`contracts.md`](contracts.md), token/component source | check, tests, build, keyboard/mobile review |
| Public photographer website | [`public-website.md`](public-website.md), public i18n resources | check, tests, build, FR/EN desktop/mobile review |
| Site profile or build pipeline | [`../decisions/ADR-013-site-profiles.md`](../decisions/ADR-013-site-profiles.md), [`../deployment.md`](../deployment.md) | check, tests, both profile builds, desktop/mobile review |
| Browser image import | [`../implementation-plan.md`](../implementation-plan.md) package PC | check, tests, fixture-based metadata tests |
| Facial search | [`security.md`](security.md), package PE | check, tests, real-device WASM validation before release |
| Dependency | [`../decisions/ADR-001-stack.md`](../decisions/ADR-001-stack.md) | new/updated ADR, check, tests, build, audit |
| Setup or deployment | README, `wrangler.jsonc`, setup script | diagnostic mode, idempotence, check, tests, build |

Package guides: [`browser-import.md`](browser-import.md), [`media-and-publication.md`](media-and-publication.md), [`public-website.md`](public-website.md), [`public-gallery.md`](public-gallery.md), and [`facial-search.md`](facial-search.md). Browser integration coverage and its provider-boundary limits are documented in [`e2e-testing.md`](e2e-testing.md). The optional fleet/operator concept is deferred in [`../future-operator-control-plane.md`](../future-operator-control-plane.md); it is not an active Cadrora runtime contract.

The point-in-time UX and release-gate review is [`production-readiness-review-2026-09-23.md`](production-readiness-review-2026-09-23.md). It separates locally verified behavior from provider and device checks that remain mandatory before a production claim.

The fresh-account [Atelier Giulia deployment rehearsal](deployment-rehearsal-2026-09-25.md) records exactly which README/Cloudflare steps have been exercised, which remain unverified, and the screenshots still required.

## Cross-cutting invariants

- The public frontend is static; event photos are never build assets.
- Worker CPU work stays small. Image processing and ML run in the browser.
- Search results never grant access to a protected event.
- A face-search outage never blocks the gallery.
- User-facing language and HTTP routes say “gallery”; the original `events` D1 table and selected internal identifiers remain storage implementation details.
- Taking a gallery offline is reversible. Permanent deletion is a distinct, typed-confirmation workflow whose provider cleanup remains durable and retryable.
- Accepted-but-uncertain cross-service operations remain pending and are reconciled; they are not blindly replayed as failures.
- Protected content is never placed in a shared CDN cache.
- UI changes ship in FR and EN and retain keyboard, focus, and 44 px touch behavior.

## Handoff checklist

1. Confirm changed files stay inside the authorized package.
2. Update affected docs or explain why none changed.
3. Run the validation appropriate to the table above.
4. Run `git diff --check` and inspect `git status --short`.
5. Report exact validation results and remaining uncertainty.
