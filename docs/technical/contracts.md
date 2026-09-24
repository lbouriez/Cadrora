# Frozen technical contracts

Status: accepted on 2026-09-22. Changes require an ADR and explicit human validation. Gallery lifecycle and presentation changes are recorded in [`ADR-005`](../decisions/ADR-005-gallery-lifecycle-and-presentation.md); isolated deployment and owner quota decisions are recorded in [`ADR-006`](../decisions/ADR-006-isolated-instances-and-owner-quotas.md); owner-approved public-site configuration changes are recorded in [`ADR-008`](../decisions/ADR-008-runtime-website-settings-and-maps.md).

Original delivery and admin-selected gallery covers are recorded in [`ADR-009`](../decisions/ADR-009-original-delivery-and-gallery-covers.md).
The shared favorites contract for protected galleries is recorded in [`ADR-010`](../decisions/ADR-010-private-gallery-shared-favorites.md).
The separate retouch-selection, replacement, and locked-gallery index contract is recorded in [`ADR-011`](../decisions/ADR-011-private-retouch-selection-and-public-gallery-index.md).

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
GET    /api/v1/galleries
GET    /api/v1/galleries/:eventId
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
```

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
| Revisioned `/media/*` | `public, max-age=31536000, immutable` | `private, max-age=3600` |
| `/media/*/download` and `/media/*/original` | `private, no-store` | `private, no-store` |
| Public event API | `public, max-age=60` keyed by revision | `private, no-store` |
| Admin API | `no-store` | `no-store` |
| Hashed app assets | `public, immutable` | `public, immutable` |

Unknown access classification fails closed as `private, no-store`. Changing an event from public to protected cannot revoke copies already downloaded.

## Authentication

- `ADMIN_AUTH_MODE` is `password` or `cloudflare-access`; there is no `none` mode.
- Password mode requires a versioned admin-domain HMAC-SHA-256 verifier plus a separate Worker-only `AUTH_PEPPER` of at least 32 random bytes. Protected-event verifiers use the same pepper under a distinct event domain. Clear passwords are never persisted.
- Password sessions are opaque. D1 stores only a token hash. Cookies are `__Host-*; HttpOnly; Secure; SameSite=Strict; Path=/` with an eight-hour default TTL.
- In password mode only and only with the explicit showcase gate, the published demo identity receives a separate one-hour, HMAC-signed `__Host-cadrora-demo` session with `access=read-only`. It is not an owner session and cannot mutate provider state. The gate defaults to false.
- Cloudflare Access JWTs are verified in the Worker for signature, issuer, audience, and expiry on every hostname.
- Event grants contain only `eventId` and `accessVersion`. A password change increments the version and invalidates old grants.
- The reserved `demo-private` password bypass exists only behind the explicit showcase gate; it is forbidden for normal events and real photographer deployments.
- State-changing admin requests verify `Origin` for CSRF protection.

## D1 and cross-service consistency

D1 contains `site_settings`, `events`, `event_credentials`, `photos`, `photo_variants`, `imports`, `import_chunks`, `faces`, `face_partitions`, `sessions`, `maintenance_jobs`, and `usage_counters`.

`site_settings.owner_gallery_limit`, `owner_storage_limit_bytes`, and `owner_face_limit` are nullable positive self-limits. Null means the deployment ceiling. The effective value is always the lower of the owner value, its deployment variable, and any provider allowance encoded as a system ceiling. Lowering a limit never deletes data; it blocks new gallery, media, or face writes until usage is below it. It must never be presented as an account-wide billing guarantee.

Photo state progresses `pending -> variants_ready -> published -> deleting -> deleted`. Facial state is independent: `disabled | pending | indexing | ready | expired | deleting | failed`. Gallery withdrawal is a reversible `events.offline_at` fence and never rewinds photo state or deletes provider objects. Permanent deletion sets `events.deleting_at`, cancels open imports, freezes photo/face writes, and enqueues one `delete_gallery` job after exact-title confirmation. Provider cleanup uses only D1-derived gallery object/vector identifiers and never touches the shared model bucket. Natural-key upserts make variant and face declarations idempotent. D1 removes access before R2 and Vectorize cleanup, which is retried from `maintenance_jobs`. Original-file delivery requires gallery downloads; disabling either choice fences original media immediately. The owner's explicit `delete_gallery_originals` job then removes only gallery-owned originals from R2 and D1 in retryable batches, leaving derived copies intact.

## UI and localization

Semantic values live in `src/app/styles/tokens.css`. Reusable typed components live in `src/app/components/` and carry a short contract/example comment. Interactive targets are at least 44 px. Modals trap focus, close on Escape, and restore focus. Every user-visible string ships in FR and EN.

The optional GA4 integration is disabled without a valid D1-backed `site_settings.analytics_measurement_id`, starts only after explicit analytics consent, and is allowlisted to `/`, `/services`, `/galleries`, `/contact`, and `/privacy`. Gallery viewer, admin, media, API, and facial-search routes never emit analytics events. The ID is public configuration, not a secret. No arbitrary script URL or code may be stored in Site settings.

Gallery links never acquire browser-default underlines or layout-changing hover movement. The wide gallery mosaic preserves photo aspect ratios. Viewer and result carousels use the shared SVG icon controls and retain a 44 px minimum target. The viewer is a rounded, backdrop-blurred lightbox on laptop/desktop viewports and becomes edge-to-edge only below the desktop breakpoint. Photo metadata is exposed only when the event's `showPhotoMetadata` flag is true. Face-search match IDs may persist only in event-keyed `sessionStorage` for the current browser session; selfies, embeddings, vector IDs, and scores may not be written there. A heart is shown in the mosaic and viewer only for protected galleries. It represents one shared D1 boolean per photo, not a per-visitor reaction or count. A favorite write requires same-origin CSRF proof, a current gallery grant, and a published photo in that protected gallery; public galleries expose neither active heart state nor the control.

A separate check-mark control selects private-gallery photos for retouching; it is not inferred from the heart. Its shared D1 boolean has the same grant, origin, availability, and photo-scope checks. The authenticated admin selections route has distinct retouch and favorites views, limited to protected-gallery photos; only the retouch view offers replacement. Its download route is manage-only and prefers retained originals, then prepared copies. Replacement requires a completed one-photo import scoped to the selected photo and atomically preserves its ID, favorites, selection, order, capture time, and facial references. Old media is deleted only through a D1-recorded maintenance job. Public gallery listing may expose only opaque protected IDs and generic presentation before unlock, never private metadata or covers.

`site_settings.theme_mode` is `light`, `dark`, `both`, or `system`; `default_language` is `fr` or `en`; and `enabled_languages` is a non-empty, unique JSON list drawn from those languages that must contain the default. Only an authenticated owner can update them. `both` preserves the local visitor preference and exposes the public switch; a fixed mode enforces that presentation and removes the switch; `system` follows `prefers-color-scheme`. One enabled language is enforced and hides the public language control; multiple enabled languages expose it. The public shell falls back to build-time language selection, both languages, and visitor-selectable colour when the settings read is unavailable.

The same owner settings include public contact fields, a non-empty unique list of enabled service keys, and either a complete map centre/radius tuple or no map tuple. Public pages fall back to build-time contact values on absent/null runtime fields and remain useful without D1. Empty strings intentionally hide individual contact fields. The keyless OpenStreetMap iframe and optional Google Maps iframe require a visitor click; Google additionally requires a restricted public Embed API key. Contact text and the outbound map link must still work if the embed does not load. The configured radius is approximate context and must not be drawn or described as a precise service boundary.

## Import and facial-search privacy

- The browser accepts decodable JPEG, PNG, and WebP only in v1. For JPEG it retains a normalized capture instant from `DateTimeOriginal` plus optional `OffsetTimeOriginal`, using the gallery timezone only when the camera omitted its offset. It corrects all eight EXIF orientations and strips the source EXIF/XMP payload—including GPS, serial numbers, and private comments—from every derived variant. When enabled for a new import, the untouched source is also stored as `original` and retains that metadata.
- Variant widths are 480, 960, 1600, 2560, and 3840 pixels, without upscaling. WebP is used only after runtime encoding and MIME verification; otherwise use JPEG.
- A visitor selfie remains local. The Worker receives an embedding only and never returns embeddings or face coordinates.
- Models load only on the find route. Facial search is disabled by default, event-scoped, expiring, and described as possible matches rather than identity confidence.
- Search and related-photo calls remain bound to the current event. `nearbySearchEnabled` requires `faceSearchEnabled`; the related-photo endpoint and client both enforce it. Per direct match, related photos are limited to the four immediately preceding and four immediately following capture instants inside a five-minute window. Upload time and `moment_id` must not expand the result. The gallery's **Found for me** view may contain both direct matches and same-event nearby photos, but they must render as separate labelled groups. Session persistence is limited to sanitized event-photo references and must omit selfies, embeddings, scores, and vector IDs.
