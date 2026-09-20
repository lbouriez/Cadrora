# Admin guide

Cadrora has one photographer-admin authority. It is not a multi-user or multi-photographer product. Admin API and page protection are enforced by the Worker on every hostname, including previews and `workers.dev`.

## Sign-in modes

Set `ADMIN_AUTH_MODE` to exactly one of:

- `password`: requires an `ADMIN_SECRET_HASH` in the strong PBKDF2 format described in [`technical/authentication.md`](technical/authentication.md). Successful login creates an opaque, D1-backed session. The cookie is `__Host-cadrora-admin`, `HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to `Path=/`.
- `cloudflare-access`: requires `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. The Worker verifies the `Cf-Access-Jwt-Assertion` signature, issuer, audience, and expiry itself. Edge Access policy is defense in depth, not a substitute for Worker verification.

Login and protected-event unlock require server-side Turnstile verification. Five failed password attempts from one `CF-Connecting-IP` block the next attempt for 15 minutes. Every state-changing `/api/v1/admin/*` request checks that `Origin` exactly matches the request origin.

Logout revokes a password session in D1 and clears its cookie. A password session is also rotated when `GET /api/v1/admin/session` succeeds. Expired or revoked rows no longer authenticate.

## Admin UI

The SPA lazily mounts Worker-guarded admin routes at `/admin/login`, `/admin`, and `/admin/events/:eventId/import`. The login route renders the Turnstile challenge; it does not expose a Turnstile secret. The dashboard lists events, and the import route shows browser import plus publication readiness/publish controls.

The browser UI is still not a substitute for validating deployed authorization. Test the exact protected hostname and API response before relying on it operationally. Do not weaken `/admin` protection or expose a password/token in browser configuration.

## Event lifecycle

The live admin API can create, list, and update events. An event has a stable slug, one of `draft`, `published`, or `unlisted` visibility states, and either `public` or `protected` access.

- Draft events return 404 to public routes.
- Published public events are listed by the landing-page query.
- Unlisted events are available by direct URL but are not listed or promoted.
- A protected event needs a password. Updating that password increments the access version and invalidates existing event grants.
- Setting access to public removes its event credential.

Create an event before declaring an import. Event creation accepts title, optional slug/description, start time, timezone, visibility, access, downloads, face-search choice, originals choice, and optional retention days. The server creates a slug from the title if no valid slug is supplied; it resolves collisions by adding a suffix.

## Import and publication sequence

The mounted browser import screen follows this server sequence; any compatible API client must follow it too:

1. Create `POST /api/v1/admin/events/:eventId/imports` with a client-generated import ID and total photo count.
2. Declare at most 50 photo records in each `POST /api/v1/admin/imports/:importId/photos` chunk.
3. Upload all five derived variants per photo: `thumb`, `small`, `medium`, `large`, and `download`.
4. Finalize each photo only after all five variants exist.
5. Review `GET /api/v1/admin/events/:eventId/publication`, then publish with `POST /api/v1/admin/events/:eventId/publish` and `visibility` of `published` or `unlisted`.

The server enforces `MAX_PHOTOS_PER_EVENT`, `MAX_STORAGE_BYTES`, MIME/magic-byte agreement, byte size, dimensions, and SHA-256 checksum. An import is idempotent only when the same natural IDs and chunk contents are replayed; conflicting IDs return a conflict rather than being silently reused.

Publication requires at least one photo and no visible photo outside `variants_ready` or `published`. Facial indexing is optional and does not block a gallery.

## Delete and purge behavior

Deleting a photo immediately changes D1 state to `deleting`, so media lookup returns 404 before provider cleanup finishes. It enqueues a `delete_photo_media` maintenance job. Face purging similarly enqueues `purge_event_faces`.

The Worker defines a 15-minute Cron Trigger that enqueues expired face purges and runs maintenance. It has no administrative maintenance-job screen. Confirm the trigger has actually executed and the relevant job reached `completed` before claiming physical R2/Vectorize deletion is complete.

## Operator habits

- Keep admin credentials, session cookies, Turnstile secrets, and event passwords out of tickets and screenshots.
- Check the exact hostname when testing protection; custom, preview, and `workers.dev` must behave alike.
- Review `GET /api/v1/admin/usage` as an application snapshot, not a Cloudflare bill or quota guarantee.
- Preserve the static `/` and `/contact` public website while testing admin paths.
