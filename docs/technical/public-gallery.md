# Events and public gallery integration

Package PB remains isolated behind central Worker and SPA registration, without coupling event behavior to either application root.

## Worker integration

- Call `registerPublicRoutes(app, services)` from `src/server/routes/public/index.ts` at the feature-route marker in `src/server/app.ts`.
- Call `registerAdminEventRoutes(app)` from `src/server/routes/admin/events.ts` at the same marker.
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
- The gallery renders lazy responsive image sources and provides Escape, arrow-key, button, and horizontal-swipe viewer navigation. It links downloads only when the event permits them and a download variant exists.
