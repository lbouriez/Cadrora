# Frozen technical contracts

Status: accepted on 2026-09-22. Changes require an ADR and explicit human validation. Gallery lifecycle and presentation changes are recorded in [`ADR-005`](../decisions/ADR-005-gallery-lifecycle-and-presentation.md); isolated deployment and owner quota decisions are recorded in [`ADR-006`](../decisions/ADR-006-isolated-instances-and-owner-quotas.md); owner-approved public-site configuration changes are recorded in [`ADR-008`](../decisions/ADR-008-runtime-website-settings-and-maps.md).
The gallery-count cap removal is recorded in [`ADR-017`](../decisions/ADR-017-remove-gallery-count-limit.md).

Original delivery and admin-selected gallery covers are recorded in [`ADR-009`](../decisions/ADR-009-original-delivery-and-gallery-covers.md).
The shared favorites contract for protected galleries is recorded in [`ADR-010`](../decisions/ADR-010-private-gallery-shared-favorites.md).
The separate retouch-selection, replacement, and locked-gallery index contract is recorded in [`ADR-011`](../decisions/ADR-011-private-retouch-selection-and-public-gallery-index.md).
Browser-local public hearts and the gallery retouch-closure switch are recorded in [`ADR-015`](../decisions/ADR-015-public-browser-hearts-and-retouch-closure.md).
Per-gallery D1-recorded storage in the admin list is recorded in [`ADR-016`](../decisions/ADR-016-admin-gallery-storage-usage.md).
The admin gallery photo count is recorded in [`ADR-019`](../decisions/ADR-019-admin-gallery-photo-count.md).
Permanent portfolio, service pricing details, and global gallery directory control are recorded in [`ADR-032`](../decisions/ADR-032-portfolio-and-gallery-directory.md).
Portfolio collections and gallery-style presentation are recorded in [`ADR-033`](../decisions/ADR-033-portfolio-collections.md).
Build-time presentation profiles and the optional independent-account pipeline are recorded in [`ADR-013`](../decisions/ADR-013-site-profiles.md); they do not change API or authentication contracts.
Owner-managed service cards and prepared marketing images are recorded in [`ADR-028`](../decisions/ADR-028-owner-managed-service-cards.md).
Complete built-in service example reset is recorded in [`ADR-031`](../decisions/ADR-031-service-example-reset.md).
Owner-managed Home introduction copy and photo are recorded in [`ADR-029`](../decisions/ADR-029-owner-managed-home-introduction.md).
Configurable Home introduction buttons and legacy-copy conversion are recorded in [`ADR-030`](../decisions/ADR-030-configurable-home-actions.md).
Event-date directory ordering and bounded, owner-controlled home stories are recorded in [`ADR-021`](../decisions/ADR-021-gallery-event-date-and-home-stories.md), superseding ADR-012's creation-order rule.
Future-import deduplication and bounded variant-upload retry are recorded in [`ADR-014`](../decisions/ADR-014-gallery-scoped-future-import-deduplication.md).
Admin recovery of unfinished imports from exact original files is recorded in [`ADR-020`](../decisions/ADR-020-admin-import-recovery-from-originals.md).

## Platform boundaries

- React + TypeScript + Vite with the official Cloudflare plugin.
- Hono in one Worker; no SSR, microservices, ORM, Docker, CLI product surface, or Redux.
- Shared Zod validation for every API request and response.
- Raw D1 SQL, private R2 media, optional Vectorize, and browser-side heavy processing.
- TanStack Query for server state; React Context only for auth, theme, i18n, and UI hosts such as toasts.

## API routes

Public routes:

```text
GET    /api/v1/site
GET    /api/v1/services
GET    /api/v1/portfolio
GET    /api/v1/portfolio/:slug
GET    /api/v1/galleries
GET    /api/v1/galleries/:eventId
GET    /api/v1/galleries/:eventId/preview
POST   /api/v1/galleries/:eventId/unlock
GET    /api/v1/galleries/:eventId/photos?cursor=...
PUT    /api/v1/galleries/:eventId/photos/:photoId/favorite
POST   /api/v1/galleries/:eventId/face-search
GET    /api/v1/galleries/:eventId/photos/:photoId/related
GET    /media/:eventId/:photoId/:revision/:variant
```

Admin routes:

```text
POST   /api/v1/admin/login
POST   /api/v1/admin/logout
GET    /api/v1/admin/session
GET    /api/v1/admin/site
PATCH  /api/v1/admin/site
PATCH  /api/v1/admin/site/home-hero
POST   /api/v1/admin/site/home-hero/reset
GET    /api/v1/admin/services
GET    /api/v1/admin/portfolio
GET    /api/v1/admin/portfolio/collections
POST   /api/v1/admin/portfolio/collections
GET    /api/v1/admin/portfolio/collections/:id
PATCH  /api/v1/admin/portfolio/collections/:id
DELETE /api/v1/admin/portfolio/collections/:id
POST   /api/v1/admin/portfolio
PATCH  /api/v1/admin/portfolio/:id
PUT    /api/v1/admin/portfolio/:id/image/:variant
POST   /api/v1/admin/portfolio/:id/publish
DELETE /api/v1/admin/portfolio/:id
GET    /api/v1/admin/portfolio/:id/image/:variant
POST   /api/v1/admin/services
PATCH  /api/v1/admin/services/:id
POST   /api/v1/admin/services/:id/reset
POST   /api/v1/admin/services/:id/image-revision
PUT    /api/v1/admin/services/:id/image/:revision/:variant
POST   /api/v1/admin/services/:id/image/:revision/publish
GET    /api/v1/admin/galleries
GET    /api/v1/admin/galleries/:eventId/cover-photos?offset=...
GET    /api/v1/admin/galleries/:eventId/cover-photos/:photoId
GET    /api/v1/admin/galleries/:eventId/originals
POST   /api/v1/admin/galleries/:eventId/originals/cleanup
POST   /api/v1/admin/galleries/:eventId/originals/abandon-imports
POST   /api/v1/admin/galleries
PATCH  /api/v1/admin/galleries/:eventId
DELETE /api/v1/admin/galleries/:eventId
POST   /api/v1/admin/galleries/:eventId/imports
GET    /api/v1/admin/galleries/:eventId/import-recovery
POST   /api/v1/admin/galleries/:eventId/photo-duplicates
POST   /api/v1/admin/imports/:importId/cancel
POST   /api/v1/admin/imports/:importId/photos
PUT    /api/v1/admin/photos/:photoId/variants/:variant
POST   /api/v1/admin/photos/:photoId/faces
POST   /api/v1/admin/photos/:photoId/finalize
POST   /api/v1/admin/galleries/:eventId/publish
PUT    /api/v1/admin/galleries/:eventId/publication
DELETE /api/v1/admin/photos/:photoId
POST   /api/v1/admin/galleries/:eventId/purge-faces
GET    /api/v1/admin/usage
GET    /service-media/:id/:revision/:variant
GET    /portfolio-media/:id/:variant
GET    /home-hero-image/:variant
```

Each event in the authenticated `GET /api/v1/admin/galleries` response includes `storageBytes`, the nonnegative sum of all recorded `photo_variants.byte_size` values for that gallery's photos. It includes prepared formats and retained originals, including rows from unfinished imports. Public gallery responses do not include this field.
Each event also includes `photoCount`, the nonnegative count of its D1 photo rows except those in `deleting` or `deleted` state. This matches the admin publication summary's total and can include unfinished imports. Public gallery responses do not include this field.
The admin import-recovery response contains only pending ordinary-import photo IDs, filenames, source SHA-256 hashes, whether originals were retained, and D1-missing variant names. It grants no new media access; the existing upload and finalize routes enforce gallery and import state.

All API errors are JSON `{ code, message, requestId }`. `message` is an i18n key. `/api/*` never falls back to HTML.

## Worker middleware

The conceptual order is fixed:

```text
requestId -> errorBoundary -> securityHeaders -> authContext -> turnstile -> rateLimit -> demoReadOnly -> route -> cacheHeaders
```

Hono implements the error boundary through `app.onError`; its module occupies the same boundary in the chain. Each other middleware is isolated in `src/server/middleware/`. New orthogonal behavior gets a new module and one registration in `app.ts`.

`authContext` resolves optional verified admin and event-grant state without throwing for absence. Turnstile runs only for admin login and event unlock. Rate limiting is best-effort, process-local protection and is not a global quota. `demoReadOnly` is a server capability boundary: a demo identity may use only the exact allowlisted admin reads plus login/logout. It rejects every other admin request before a route can touch D1, R2, or another provider.

## Cache policy

| Content | Public event | Protected event |
| --- | --- | --- |
| Revisioned `/media/*` display | `public, max-age=60, must-revalidate` (browser); optional five-minute inner Worker cache after D1 authorization when `FEATURE_PUBLIC_MEDIA_CACHE=true` | `private, max-age=3600` |
| `/media/*/download` and `/media/*/original` | `private, no-store` | `private, no-store` |
| Public event API | `public, max-age=60` keyed by revision | `private, no-store` |
| Admin API | `no-store` | `no-store` |
| Hashed app assets | `public, immutable` | `public, immutable` |

Published service-card images use versioned `/service-media/*` URLs. The default Worker resolves the current D1 variant on every request and uses the dedicated `ServiceMediaCache` entrypoint for a five-minute public edge copy, falling back to R2 on cache failure. They are unrelated to gallery grants and never make the private R2 bucket directly public.

Unknown access classification fails closed as `private, no-store`. Changing an event from public to protected cannot revoke copies already downloaded.

## Authentication

- `ADMIN_AUTH_MODE` is `password` or `cloudflare-access`; there is no `none` mode.
- Password mode requires a versioned admin-domain HMAC-SHA-256 verifier plus a separate Worker-only `AUTH_PEPPER` of at least 32 random bytes. Protected-event verifiers use the same pepper under a distinct event domain. Clear passwords are never persisted.
- Password sessions are opaque. D1 stores only a token hash. Cookies are `__Host-*; HttpOnly; Secure; SameSite=Strict; Path=/` with an eight-hour default TTL.
- In password mode only and only with the explicit showcase gate, the published demo identity receives a separate one-hour, HMAC-signed `__Host-cadrora-demo` session with `access=read-only`. It is not an owner session and cannot mutate provider state. The gate defaults to false.
- Cloudflare Access JWTs are verified in the Worker for signature, issuer, audience, and expiry on every hostname.
- Event grants contain only `eventId` and `accessVersion`. A password change increments the version and invalidates old grants.
- An owner with a verified `manage` admin session may request a current event grant for a published, online protected gallery through a same-origin admin POST. The ordinary protected gallery API and media checks still require that grant; draft, offline, deleting, and read-only demo access never issue an owner grant.
- The reserved `demo-private` password bypass exists only behind the explicit showcase gate; it is forbidden for normal events and real photographer deployments.
- State-changing admin requests verify `Origin` for CSRF protection.

## D1 and cross-service consistency

D1 contains `site_settings`, `events`, `event_credentials`, `photos`, `photo_variants`, `imports`, `import_chunks`, `faces`, `face_partitions`, `sessions`, `maintenance_jobs`, and `usage_counters`.

`site_settings.owner_storage_limit_bytes` and `owner_face_limit` are nullable positive self-limits. Null means the deployment ceiling. The effective value is always the lower of the owner value, its deployment variable, and any provider allowance encoded as a system ceiling. Lowering a limit never deletes data; it blocks new media or face writes until usage is below it. Gallery creation has no count quota. These limits must never be presented as an account-wide billing guarantee.

Photo state progresses `pending -> variants_ready -> published -> deleting -> deleted`. Facial state is independent: `disabled | pending | indexing | ready | expired | deleting | failed`. Gallery withdrawal is a reversible `events.offline_at` fence and never rewinds photo state or deletes provider objects. Permanent deletion sets `events.deleting_at`, cancels open imports, freezes photo/face writes, and enqueues one `delete_gallery` job after exact-title confirmation. Provider cleanup uses only D1-derived gallery object/vector identifiers and never touches the shared model bucket. Natural-key upserts make variant and face declarations idempotent. D1 removes access before R2 and Vectorize cleanup, which is retried from `maintenance_jobs`. Original-file delivery requires gallery downloads; disabling either choice fences original media immediately. The owner's explicit `delete_gallery_originals` job then removes only gallery-owned originals from R2 and D1 in retryable batches, leaving derived copies intact.

## UI and localization

Semantic values live in `src/app/styles/tokens.css`. Reusable typed components live in `src/app/components/` and carry a short contract/example comment. Interactive targets are at least 44 px. Modals trap focus, close on Escape, and restore focus. Every user-visible string ships in FR and EN.

The optional GA4 integration is disabled without a valid D1-backed `site_settings.analytics_measurement_id`, starts only after explicit analytics consent, and is allowlisted to `/`, `/services`, `/portfolio`, `/portfolio/:slug`, `/galleries`, `/contact`, and `/privacy`. Customer gallery viewer, admin, media, API, and facial-search routes never emit analytics events. The ID is public configuration, not a secret. No arbitrary script URL or code may be stored in Site settings.

Gallery links never acquire browser-default underlines or layout-changing hover movement. The wide gallery mosaic preserves photo aspect ratios. Viewer and result carousels use the shared SVG icon controls and retain a 44 px minimum target. The viewer is a rounded, backdrop-blurred lightbox on laptop/desktop viewports and becomes edge-to-edge only below the desktop breakpoint. Photo metadata is exposed only when the event's `showPhotoMetadata` flag is true. Face-search match IDs may persist only in event-keyed `sessionStorage` for the current browser session; selfies, embeddings, vector IDs, and scores may not be written there. A heart is shown in the mosaic and viewer for both public and protected galleries. Protected hearts represent one shared D1 boolean per photo; a favorite write requires same-origin CSRF proof, a current gallery grant, and a published photo in that protected gallery. Public hearts live only in gallery-keyed browser `localStorage`, with in-memory fallback. The public photo API masks D1 hearts and public favorite API writes remain forbidden.

[`ADR-012`](../decisions/ADR-012-gallery-directory-and-progressive-photos.md) adds owner-controlled directory inclusion, default on. The public listing includes only published, online galleries with `showOnGalleryPage=true`, ordered across public and protected cards by event date descending, then ID ascending as updated by ADR-021. The setting is not access control; direct links retain their normal authorization. The gallery header is compact and text-only. Its photo API remains cursor-paginated while the client requests the next page near the viewport and progressively upgrades lazy tile images from the smallest prepared variant to a responsive larger one. A manual load-more button remains available. Site settings also control whether public gallery cards appear on the home page and cap that section at 1 to 12 cards, default 6; `/galleries` remains uncapped.

ADR-032 removes `/galleries` and all `/e/*` URLs from the sitemap and `/llms.txt` for every gallery state. The directory and direct gallery pages are marked `noindex,nofollow`; their direct links and existing access checks remain usable. The admin always exposes the copyable direct URL, including before publication and while offline. ADR-033 places portfolio photos in separately published collections, indexed at `/portfolio/:slug`. Portfolio media uses the shared browser-prepared four-variant pipeline and public `ProgressivePhoto` loader.

A separate check-mark control selects private-gallery photos for retouching; it is not inferred from the heart. Its shared D1 boolean has the same grant, origin, availability, and photo-scope checks. `events.retouch_selection_enabled` controls whether visitors can change it; disabling hides the control and rejects writes without clearing existing selections. The authenticated admin selections route has distinct retouch and favorites views, limited to protected-gallery photos; only the retouch view offers replacement. Its download route is manage-only and prefers retained originals, then prepared copies. Replacement requires a completed one-photo import scoped to the selected photo and atomically preserves its ID, favorites, selection, order, capture time, and facial references. Old media is deleted only through a D1-recorded maintenance job. Public gallery listing may expose a protected gallery's ID, slug, title, date, and description when it is published and online, but never its cover or photo media before unlock. Its locked card uses a shared static asset unrelated to private photos; the locked page may show the same public event details while its photo API stays grant-protected.

`site_settings.theme_mode` is `light`, `dark`, `both`, or `system`; `default_language` is `fr` or `en`; and `enabled_languages` is a non-empty, unique JSON list drawn from those languages that must contain the default. Only an authenticated owner can update them. `both` preserves the local visitor preference and exposes the public switch; a fixed mode enforces that presentation and removes the switch; `system` follows `prefers-color-scheme`. One enabled language is enforced and hides the public language control; multiple enabled languages expose it. The public shell falls back to build-time language selection, both languages, and visitor-selectable colour when the settings read is unavailable.

The same owner settings include public contact fields, a legacy non-empty unique list of enabled built-in service keys, a separate Home service count from 1 to 12, and either a complete map centre/radius tuple or no map tuple. The owner-managed `site_services` catalog is authoritative for actual service visibility, ordering, bilingual copy, and image revisions; the legacy list remains synchronized for compatibility and compiled fallback. Public pages fall back to build-time contact and service values on absent runtime fields or API failure and remain useful without D1. Empty strings intentionally hide individual contact fields. The keyless OpenStreetMap iframe and optional Google Maps iframe require a visitor click; Google additionally requires a restricted public Embed API key. Contact text and the outbound map link must still work if the embed does not load. The configured radius is approximate context and must not be drawn or described as a precise service boundary.

As updated by ADR-022, the public directory API returns a bounded combined page (`limit` 1–48, default 24) plus `nextCursor`; the cursor binds the access filter and `startsAt DESC, id ASC` position. The home page requests at most 12 public entries. The directory loads further pages near the viewport and has a manual button. `events.service` is nullable and constrained to the shared wedding, family, portrait, maternity, brand, work, kids, events, or other key set. A selected key adds a localized text tag to public and protected cards without relaxing protected media access.

## Import and facial-search privacy

- The browser accepts decodable JPEG, PNG, and WebP only in v1. For JPEG it retains a normalized capture instant from `DateTimeOriginal` plus optional `OffsetTimeOriginal`, using the gallery timezone only when the camera omitted its offset. It corrects all eight EXIF orientations and strips the source EXIF/XMP payload—including GPS, serial numbers, and private comments—from every derived variant. When enabled for a new import, the untouched source is also stored as `original` and retains that metadata.
- Variant widths are 480, 960, 1600, 2560, and 3840 pixels, without upscaling. WebP is used only after runtime encoding and MIME verification; otherwise use JPEG.
- A visitor selfie remains local. The Worker receives an embedding only and never returns embeddings or face coordinates.
- Models load only on the find route. Facial search is disabled by default, event-scoped, expiring, and described as possible matches rather than identity confidence.
- Search and related-photo calls remain bound to the current event. `nearbySearchEnabled` requires `faceSearchEnabled`; the related-photo endpoint and client both enforce it. Per direct match, related photos are limited to the four immediately preceding and four immediately following capture instants inside a five-minute window. Upload time and `moment_id` must not expand the result. The gallery's **Found for me** view may contain both direct matches and same-event nearby photos, but they must render as separate labelled groups. Session persistence is limited to sanitized event-photo references and must omit selfies, embeddings, scores, and vector IDs.
