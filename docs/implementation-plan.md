# Approved implementation plan

Status: implemented. Approved 2026-09-20; implementation and documentation reviewed 2026-09-21. Release-specific provider evidence must still be recorded for each deployed revision.

Post-plan extension (2026-09-24): ADR-011 adds a distinct protected-gallery retouch selection and photographer replacement workflow across PB/PC/PD, plus opaque locked-gallery index cards. Its release gate includes migration 016, private-grant and admin-role tests, desktop/mobile review, and a live replacement/cleanup smoke test.

Post-plan extension (2026-09-24): ADR-012 adds a per-gallery public-directory switch and creation-date card ordering across PB/PD, plus a compact text-only gallery header and progressive, scroll-triggered photo loading in PB. Its release gate includes migration 017, admin/index tests, large-page desktop/mobile browsing, and live verification that hidden galleries still work by direct link.

Post-plan extension (2026-09-24): ADR-013 adds build-time site profiles across the shared public UI, Vite configuration and isolated-instance deployment. The `cadrora` showcase and `atelier-giulia` profile must each build from the same commit without a named-site branch in core code. Acceptance includes FR/EN and mobile checks for the studio profile, full Cadrora browser regression, separate account-scoped GitHub secrets, and live exact-hostname HTTPS verification before claiming release completion.

Post-plan extension (2026-09-25): ADR-015 adds browser-local public hearts across PB, and a protected-gallery retouch switch across PB/PD admin settings and shared schemas. Acceptance includes migration 020, server rejection after closure, retained admin selections, and public hearts surviving reload without a favorite API request.

Post-plan extension (2026-09-26): ADR-021 changes public directory card ordering to event date and adds owner-controlled home stories visibility and a 1–12 card limit across PB, admin site settings, shared schemas, and D1 migration 024. Acceptance includes mixed public/protected order, a bounded home section, disabled-section behavior, FR/EN admin copy, and unchanged full-directory visibility.

Post-plan extension (2026-09-26): ADR-022 adds bounded keyset pagination to the combined public/protected directory and an optional gallery service across PB, admin gallery forms, shared schemas, and D1 migration 025. Acceptance includes correct event-date order across page boundaries, a bounded home request, scroll-triggered loading with manual fallback, localized category labels, and no private media in protected previews.

Post-plan extension (2026-09-27): ADR-028 adds owner-managed service cards across PB, PC image encoding, PD media delivery, admin site settings, and D1 migration 028. Acceptance includes FR/EN overrides and new cards, independent Home eligibility and count, a complete variant set before publication, D1-derived versioned image delivery, retryable cleanup, static HTML routing, and mobile/desktop Lighthouse comparison on both site profiles.

Post-plan extension (2026-09-27): ADR-032 adds a permanent, service-categorized portfolio across PB/PC/PD, bilingual service duration and pricing details in PA/PB, and a global gallery directory switch across PA/PB/PD. Acceptance includes password-protected gallery creation by default, copyable unlisted links, complete-variant portfolio publication, D1-fenced media deletion, gallery links and sitemap omitted when hidden, public-gallery creation blocked, and direct protected customer links retained.

Post-plan extension (2026-09-27): ADR-033 makes each portfolio an owner-managed collection across PB/PC/PD, with a gallery-style card and detail page, shared progressive mosaic and viewer, multi-photo admin upload, bilingual copy, cover and publication controls. Acceptance includes migration 032/backfill, public media fencing when a collection is hidden, Cadrora-only seed assets with D1/R2 parity, sample pricing marked as illustrative, and FR/EN desktop/mobile review.

Post-plan extension (2026-09-27): ADR-034 separates portfolio categories from services across PB/PD and migration 033. Acceptance includes retaining existing collection photos and covers, creating bilingual categories in the admin selector, showing category tags, preserving portfolio visibility when a service is disabled, gallery sharing and password badges, and service prices only inside their detail modal.

Post-plan extension (2026-09-27): ADR-037 adds an owner-controlled public site progress notice across PB, admin site settings, shared schemas, the Atelier Giulia seed, and D1 migration 038. Acceptance includes FR/EN public copy, Atelier-only initial enablement, owner toggling through the existing settings request, and no new public API or R2 dependency.

Post-plan extension (2026-09-29): ADR-041 adds three bilingual built-in sessions and removes the Home session count across PB, admin settings, shared schemas, and D1 migration 040. Acceptance includes FR/EN fallback copy and photos, preservation of existing session edits, direct Home visibility from each session's switch, and unchanged Recent stories limits.

This versioned plan is the coordination source for coding agents. Frozen details live in [`technical/contracts.md`](technical/contracts.md); no package may change them without an ADR and human validation.

Post-plan extension (2026-09-30): ADR-044 adds owner-managed default and phone session-photo framing across PB, the admin session editor, shared schemas, service routes, and D1 migration 041. Acceptance includes centered existing photos, nullable phone inheritance, retained framing on reorder, example reset, unchanged image revisions, FR/EN save/reload and desktop/phone preview review, and both profile builds.

Post-plan extension (2026-09-30): ADR-045 adds static localized marketing documents and sitemap alternates across PB and the build profile, optional bilingual demo-gallery copy through PB/PD and migration 042, and accessible session dots in the shared slider. Acceptance includes both profile builds, FR/EN metadata and share preview checks, keyboard/phone slide selection, localized demo gallery headings, and unchanged private-gallery access.

## Wave 1: P0 foundation

One implementation only. Deliver repository/tooling configuration, shared schemas/constants/errors, the complete middleware chain, auth test context, core D1 migration, minimal design system, FR/EN wiring, SPA/Worker routing, setup/diagnostic scripts, architecture, ADR, and quick start.

Acceptance at the P0 boundary: an empty SPA ran; the then-unimplemented `GET /api/v1/site` returned a clean JSON 404; `npm run check`, `npm run test`, and build passed; the local D1 migration applied idempotently. The endpoint was subsequently implemented in wave 2 and now returns the singleton site configuration.

## Wave 2: independent packages

Wave 2 begins only after P0 acceptance. Packages can then run in parallel against frozen contracts and mocked auth context.

### PA: authentication and admin shell

Owns `src/server/auth/*`, auth-related middleware additions, `src/server/routes/admin/auth.ts`, and `src/app/admin/*`. Deliver password authentication, verified Cloudflare Access JWTs, session rotation/revocation, Turnstile and login limiting, admin layout, language/theme controls, and hostname-independent protection. Do not implement event CRUD, import, or media.

Acceptance includes secure `__Host-` cookies, dead sessions after logout/expiry, rejection of bad issuer/audience/expiry, unauthorized admin events on every hostname, and stricter protection after five failed logins.

### PB: events and public gallery

Owns `src/app/public/*`, `src/app/routes/*`, `src/server/routes/public/*`, crawler metadata behavior, and cache classification. Deliver event CRUD, scoped unlock grants, gallery/list/detail/privacy/contact pages, stable cursor pagination, responsive image grid, keyboard/touch viewer, unlisted behavior, crawler metadata, and the cache matrix. The public surface also includes a polished static photographer website: a modern landing page presenting the photographer and services, plus a contact page with direct phone, email, address, and service-area fields and no form or external service. Do not upload photos, serve media objects, or implement face search.

Acceptance includes useful `/` and `/contact` pages even when the gallery API is unavailable, centralized build-time public profile configuration with no invented contact data, FR/EN content, responsive layouts, and strict separation from `/e/*` grants and `/admin/*` authentication.

### PC: browser import pipeline

Owns `src/browser/images/*`, `src/browser/jobs/*`, admin import UI, and admin import/photo upload/finalize routes. Deliver format validation, eight EXIF orientations, private metadata stripping, five non-upscaled variants, verified WebP fallback, Web Worker encoding, IndexedDB chunk journal, resume, bounded concurrency, progress/ETA/pause/cancel, and quota rejection. Do not create embeddings, a CLI, video, HEIC, or RAW support.

### PD: media and publication

Owns media route, storage services, repositories, publication UI, and maintenance. Deliver D1-derived streaming media access, public/protected cache headers, publication status, D1-first deletion plus retryable provider cleanup, optional originals, and usage counters. Do not encode images or implement face search.

### PE: facial search

Owns `src/browser/faces/*`, face-search routes/vector service, find UI, and model scripts. Deliver verified immutable YuNet/SFace manifests, lazy WASM-first inference, local consent/selfie handling, partitioned indexing, adaptive fan-out with signed cursor, possible-match language, expiry blocking/purge, and functional operation without Vectorize. Do not upload selfies, expose vectors/coordinates, identify people, or correlate events.

## Wave 3: integration and release

After all five packages pass their acceptance checks, integrate end-to-end photographer, visitor, protected gallery, download, facial search, and killed-tab resume journeys. Finalize fresh-account deployment, preview isolation, diagnostics, operator/admin documentation, API/security/privacy/free-tier/upgrade docs, notices, security policy, and contribution guide.

Local implementation and browser coverage are complete. The import suite verifies real pipeline chunking over 200 synthetic files, restart from the first unfinished chunk after 100 finalizations, and browser IndexedDB/UI recovery over four 50-photo chunks. The public showcase has been deployed to Cloudflare, but each new revision still requires exact-deployment smoke tests. A fresh third-party account rehearsal, a real interrupted import with representative 50/200-photo payloads, and iPhone Safari facial-search validation remain release-acceptance work; deterministic local fakes and dry runs do not replace those checks.

## Guardrails

ADR-049 preview experiment (approved 2026-10-03): shared PB Home/Sessions components, PA build flags and shared DTOs, and the existing Worker public-data boundary may participate in an isolated Cadrora renderer. No admin/gallery authorization or publication mutation changes are part of the uncached prototype. Acceptance requires matching hydration/first-frame behavior, fresh transactional public data, static/fail-closed fallbacks, repeated equivalent Lighthouse measurements, both profile regressions and exact-preview deployment evidence before production adoption.

1. The frontend is static and gallery photos never enter the build.
2. The browser receives no secrets or provider bindings.
3. Heavy processing never runs in the Worker.
4. API and media authorization are independent and mandatory.
5. Search never grants gallery access.
6. Selfies stay local; no identity profile or cross-gallery matching exists.
7. Embeddings remain expiring biometric data.
8. ML failure never blocks galleries.
9. Cross-service operations are idempotent and repaired through `maintenance_jobs`.
10. Product copy does not promise unlimited free use, perfect matching, or instant physical deletion.
11. Normal photographer operation is browser-only.
12. The public photographer website has no contact form, tracker, remote font, map, or other external runtime dependency by default. ADR-008 permits optional consented GA4 and a click-to-load OpenStreetMap map (or Google map with an optional key) while preserving static fallbacks.

Post-plan extension (2026-10-01): ADR-046 adds an optional public Sessions page across PB, admin Website settings, shared schemas, Worker HTML routing and migration 043. Acceptance includes default-on compatibility, omitted PATCH preservation, FR/EN controls, all session URLs returning 404 when disabled, sitemap/llms omission, retained Home sessions, and both profile builds.

Post-plan correction (2026-10-01): ADR-047 separates Home and Sessions selection across PB, admin badges/previews, shared catalog routes and Contact context. It expands framing metadata with Top/Bottom via migration 044, preserving existing values and image revisions. Acceptance: home-only complete custom sessions appear on Home and in Contact context, stay absent from Sessions, and are not marked Hidden; fully hidden/incomplete sessions remain unpublished; FR/EN selectors save/reload vertical framing with matching progressive layers and phone inheritance; check, tests, both builds and browser checks pass locally before push.
