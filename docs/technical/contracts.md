# Frozen technical contracts

Status: accepted on 2026-09-22. Changes require an ADR and explicit human validation. Gallery lifecycle and presentation changes are recorded in [`ADR-005`](../decisions/ADR-005-gallery-lifecycle-and-presentation.md); isolated deployment and owner quota decisions are recorded in [`ADR-006`](../decisions/ADR-006-isolated-instances-and-owner-quotas.md).

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
POST   /api/v1/admin/galleries
PATCH  /api/v1/admin/galleries/:eventId
DELETE /api/v1/admin/galleries/:eventId
POST   /api/v1/admin/galleries/:eventId/imports
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

Photo state progresses `pending -> variants_ready -> published -> deleting -> deleted`. Facial state is independent: `disabled | pending | indexing | ready | expired | deleting | failed`. Gallery withdrawal is a reversible `events.offline_at` fence and never rewinds photo state or deletes provider objects. Permanent deletion sets `events.deleting_at`, cancels open imports, freezes photo/face writes, and enqueues one `delete_gallery` job after exact-title confirmation. Provider cleanup uses only D1-derived gallery object/vector identifiers and never touches the shared model bucket. Natural-key upserts make variant and face declarations idempotent. D1 removes access before R2 and Vectorize cleanup, which is retried from `maintenance_jobs`.

## UI and localization

Semantic values live in `src/app/styles/tokens.css`. Reusable typed components live in `src/app/components/` and carry a short contract/example comment. Interactive targets are at least 44 px. Modals trap focus, close on Escape, and restore focus. Every user-visible string ships in FR and EN.

The optional GA4 integration is disabled without `VITE_GA_MEASUREMENT_ID`, starts only after explicit analytics consent, and is allowlisted to `/`, `/services`, `/galleries`, `/contact`, and `/privacy`. Gallery viewer, admin, media, API, and facial-search routes never emit analytics events.

Gallery links never acquire browser-default underlines or layout-changing hover movement. Viewer and result carousels use the shared SVG icon controls and retain a 44 px minimum target. The viewer is a rounded, backdrop-blurred lightbox on laptop/desktop viewports and becomes edge-to-edge only below the desktop breakpoint. Photo metadata is exposed only when the event's `showPhotoMetadata` flag is true. Face-search match IDs may persist only in event-keyed `sessionStorage` for the current browser session; selfies, embeddings, vector IDs, and scores may not be written there.

`site_settings.theme_mode` is `light`, `dark`, `both`, or `system`; `default_language` is `fr` or `en`; and `enabled_languages` is a non-empty, unique JSON list drawn from those languages that must contain the default. Only an authenticated owner can update them. `both` preserves the local visitor preference and exposes the public switch; a fixed mode enforces that presentation and removes the switch; `system` follows `prefers-color-scheme`. One enabled language is enforced and hides the public language control; multiple enabled languages expose it. The public shell falls back to build-time language selection, both languages, and visitor-selectable colour when the settings read is unavailable.

## Import and facial-search privacy

- The browser accepts decodable JPEG, PNG, and WebP only in v1. For JPEG it retains a normalized capture instant from `DateTimeOriginal` plus optional `OffsetTimeOriginal`, using the gallery timezone only when the camera omitted its offset. It corrects all eight EXIF orientations and strips the source EXIF/XMP payload—including GPS, serial numbers, and private comments—from every derived variant.
- Variant widths are 480, 960, 1600, 2560, and 3840 pixels, without upscaling. WebP is used only after runtime encoding and MIME verification; otherwise use JPEG.
- A visitor selfie remains local. The Worker receives an embedding only and never returns embeddings or face coordinates.
- Models load only on the find route. Facial search is disabled by default, event-scoped, expiring, and described as possible matches rather than identity confidence.
- Search and related-photo calls remain bound to the current event. `nearbySearchEnabled` requires `faceSearchEnabled`; the related-photo endpoint and client both enforce it. Per direct match, related photos are limited to the four immediately preceding and four immediately following capture instants inside a five-minute window. Upload time and `moment_id` must not expand the result. The gallery's **Found for me** view may contain both direct matches and same-event nearby photos, but they must render as separate labelled groups. Session persistence is limited to sanitized event-photo references and must omit selfies, embeddings, scores, and vector IDs.
