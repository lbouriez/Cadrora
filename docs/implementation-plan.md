# Approved implementation plan

Status: implemented. Approved 2026-09-20; implementation and documentation reviewed 2026-09-21. Release-specific provider evidence must still be recorded for each deployed revision.

Post-plan extension (2026-09-24): ADR-011 adds a distinct protected-gallery retouch selection and photographer replacement workflow across PB/PC/PD, plus opaque locked-gallery index cards. Its release gate includes migration 016, private-grant and admin-role tests, desktop/mobile review, and a live replacement/cleanup smoke test.

This versioned plan is the coordination source for coding agents. Frozen details live in [`technical/contracts.md`](technical/contracts.md); no package may change them without an ADR and human validation.

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
