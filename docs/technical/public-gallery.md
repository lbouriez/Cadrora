# Events and public gallery integration

Package PB remains isolated behind central Worker and SPA registration, without coupling event behavior to either application root.

## Worker integration

- Call `registerPublicRoutes(app, services)` from `src/server/routes/public/index.ts` at the feature-route marker in `src/server/app.ts`.
- Call `registerAdminEventRoutes(app)` from `src/server/routes/admin/galleries.ts` at the same marker.
- Register `ogMetadata` from `src/server/middleware/ogMetadata.ts` before the static asset fallback. It responds only to recognized crawlers on event paths; ordinary SPA navigation continues normally.
- PB applies its cache classification directly and also records `cachePolicy`, because Hono middleware registered after a terminating route cannot post-process that response.
- Supply `issueEventGrant` to `registerPublicRoutes`. The callback must issue PA's signed/opaque grant containing only `eventId` and `accessVersion`. The route fails closed with `503` if no issuer is configured. PA's auth context must verify that grant before exposing it to PB.

## SPA integration

- Import `publicRouteObjects` from `src/app/routes/publicRoutes.tsx` into the root router. Importing the module installs the package-local FR and EN resource bundles and public gallery CSS.
- Configure `configurePublicGallery({ getTurnstileToken })` from `src/app/public/config.ts` with PA's event-unlock Turnstile widget. The default provider returns no token and unlock fails closed.
- The route objects cover `/`, `/e/:slug`, `/e/:slug/photo/:photoId`, `/privacy`, and `/contact`.

## Behavioral contracts

- Slugs are assigned once at creation and cannot be changed by the update schema.
- Only public `published` events appear in the event list. Protected event metadata requires a current event grant; before unlock the UI shows a generic prompt without leaking title or description. `unlisted` events work by direct URL and emit `noindex,nofollow` for crawlers and browser metadata. Drafts return `404`.
- Photo cursors encode `sortKey`, `id`, and the event revision. A cursor from an older revision returns `409` instead of skipping or duplicating silently.
- Public event APIs use `public, max-age=60`; protected event APIs and crawler shells use `private, no-store`; admin APIs use `no-store`. Revisioned media classifications remain owned by package PD.
- The gallery renders lazy responsive image sources and provides Escape, arrow-key, button, and horizontal-swipe viewer navigation. On laptop and desktop viewports the viewer is an almost-full-screen rounded lightbox over a blurred backdrop; touch-sized viewports remain edge-to-edge. Shared SVG icon controls remain geometrically centered and hover states must not replace positional transforms. It links downloads only when the event permits them and a download variant exists.
- Visitor download selection is gallery-local and works on loaded photos, including the filtered "Found for me" view. One photo uses the authorized media attachment directly. For multiple photos, `downloadPhotos.ts` streams into a unique child directory through `showDirectoryPicker` when supported, or lazily constructs a bounded ZIP on the visitor device. The latter accepts at most 100 photos/250 MB, keeps the selection on failure, and offers the finished Blob through a user-clicked link. Every media URL is constrained to the same-origin, exact gallery/photo/revision `download` route; the Worker rechecks authorization for each request. Keep the folder picker call inside the original click activation.
- `showPhotoMetadata` is an event-level owner setting that defaults off. When enabled, the viewer information control reveals only filename, event-local capture date/time (including seconds and timezone), and dimensions already returned by the authorized photo API.
- A successful face search stores only up to the default 2,000-photo event cap as sanitized direct-match and nearby-moment references in event-keyed `sessionStorage`. Nearby context is at most four photos before and four after each match, based only on same-gallery capture instants within five minutes. The gallery exposes an **All photos / Found for me** control, automatically loads paginated results, and renders possible matches and nearby moments in distinct labelled groups. Viewer links preserve whether they originated in the gallery or find page; closing returns to that source. Storage contains no selfie, crop, embedding, similarity score, or vector ID.
