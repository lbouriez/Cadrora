# ADR-028: Owner-managed service cards and browser-prepared images

Status: accepted by the owner's 2026-09-27 implementation request. This extends ADR-008 and ADR-013.

## Context

The five compiled service cards could only be enabled or hidden. Their bilingual text, photo, and order required a build to change. Owners need to edit those cards, add services, select which are eligible for Home, and limit the number shown there without turning the public site into Worker-rendered HTML.

## Decision

- Keep the five profile-backed cards and FR/EN resources as a useful fallback when D1 is unavailable. D1 records override their text, order, image, and visibility; a new custom card is published only with bilingual copy and a complete prepared image.
- Reuse the gallery browser image decoder, EXIF orientation normalization, metadata removal, verified WebP/JPEG encoding, and streaming R2 upload path. The service recipe uses 320, 640, 960, and 1280 px variants without upscaling. Gallery import journals, capture dates, originals, and gallery publication rules do not apply to marketing images.
- Keep a dedicated `site_services` D1 catalog and D1 rows for every uploaded variant. R2 objects stay in the private media bucket under a separate `site/services/` namespace. The owner uploads all variants to a pending revision before the revision is published. Replacement fences old URLs in D1 and queues retryable `delete_service_media` cleanup.
- Serve only the published revision at versioned `/service-media/*` URLs. The default Worker checks D1 first, then the named `ServiceMediaCache` entrypoint may serve a cached public image; a cache failure falls back to R2. The HTML routes remain static assets. The public service catalog API is optional for the browser; compiled defaults remain visible during failure.
- Each service has an independent Home-eligibility switch. `site_settings.home_services_limit` is the maximum number of eligible, enabled cards shown on Home, default 3. Admin ordering determines which cards fit. The Services page shows every enabled, published card.
- Reuse the existing localized text editor. The Home short description is distinct from the Services-page description. Both languages are required for newly authored copy.
- The last Services card spans both columns only when the visible card count is odd; an even count forms complete rows.

## Consequences

The service catalog and images can change without a deployment. Public text still appears after the optional browser API request, and static HTML/social previews remain build-time content. Service variants count toward the existing D1 storage counter and instance quota. Public images can remain in a browser or edge cache briefly after an edit; the new page references only the new revision. Lighthouse and provider-backed image delivery must be checked before release.
