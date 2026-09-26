# Cadrora features

This catalogue groups product features by area. Many site and gallery settings live in D1; deployment feature flags are Worker environment variables. Follow the linked guides for detailed behavior.

## Site

| Feature | Description |
| --- | --- |
| Photographer website | Public home, services, galleries, contact, and privacy pages. The website remains available independently of gallery access. [Public website guide](technical/public-website.md) |
| Languages and appearance | French and English content, site profile, theme, and contact details. [Admin guide](admin-guide.md) |
| Search indexing | Robots and sitemap responses are generated from current site and published gallery data. Gallery listing can be controlled per gallery. [Public website guide](technical/public-website.md) |
| Optional integrations | Analytics requires consent; maps load on demand when configured. [Public website guide](technical/public-website.md) |

## Galleries

| Feature | Description |
| --- | --- |
| Publication and access | Draft, published, and offline states; public, unlisted, and password-protected access. Offline and deletion are separate actions. [Public gallery guide](technical/public-gallery.md) |
| Admin gallery access | An admin can open a published, online protected gallery without entering its visitor password. [Admin guide](admin-guide.md) |
| Gallery viewing | Responsive photo grid and viewer with progressive image loading. [Public gallery guide](technical/public-gallery.md) |
| Visitor actions | Configurable downloads, favorites, retouch selections, and ZIP delivery. [Public gallery guide](technical/public-gallery.md) |
| Discovery and details | Optional face search, nearby photos, and photo metadata. [Public gallery guide](technical/public-gallery.md) |
| Public media edge cache | Deployment feature flag, **disabled by default**. See [Public media edge cache](#public-media-edge-cache). |

## Photos and import

| Feature | Description |
| --- | --- |
| Browser import | The browser prepares image variants and removes private metadata before upload. Interrupted imports can be resumed; quota checks guard new imports. [Browser import guide](technical/browser-import.md) |
| Responsive variants | Multiple sizes support progressive display on the website, gallery cards, grid, and viewer. [Public gallery guide](technical/public-gallery.md) |
| Originals and replacement | Keeping originals is optional; the admin can replace a photo while preserving its gallery record. [Admin guide](admin-guide.md) |

## Admin and operations

| Feature | Description |
| --- | --- |
| Gallery management | Configure visibility, access, visitor options, retention, and publication from the admin area. [Admin guide](admin-guide.md) |
| Storage usage and quota | Usage is shown in the admin area and checked during import. [Admin guide](admin-guide.md) |
| Retryable cleanup | D1 records the authoritative state; maintenance jobs retry cross-service cleanup after access is fenced. [Architecture](architecture.md) |

## Public media edge cache

`FEATURE_PUBLIC_MEDIA_CACHE` controls the typed `publicMediaCache` deployment feature flag. Its value must be exactly `true` to enable the cache; unset or `false` disables it. The deployment workflow defaults to **disabled**.

When enabled, display variants for **published, online public galleries** can be cached at Cloudflare's edge. This includes unlisted galleries opened by direct link when their access mode is public. The first request for a variant fills the cache; later requests for it can avoid an R2 read and arrive faster. Existing eligible galleries are covered as soon as the enabled Worker is deployed: no re-import or migration is needed. There is **no retroactive prewarming**; each variant starts cold until requested. Originals and downloads, protected galleries, drafts, and offline galleries do not use this cache.

The potential benefit is lower repeat-view latency and fewer R2 reads for popular public photos. Each media request still performs its D1 access check, and the cache adds a Worker invocation. Therefore lower total cost and a better Lighthouse score are not guaranteed. Measure representative traffic before keeping the flag enabled. See [Cloudflare Workers Cache pricing](https://developers.cloudflare.com/workers/cache/#pricing) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/) for billing units.

To enable it, set the Worker environment variable `FEATURE_PUBLIC_MEDIA_CACHE=true` in the target deployment and redeploy. For Atelier Giulia, add the GitHub Environment variable to `atelier-giulia-production` and rerun its production deployment workflow. To disable it, set the variable to `false` (or remove it) and redeploy. See [Deployment](deployment.md) for the procedure and [ADR-021](decisions/ADR-021-public-gallery-media-cache.md) for the design.

Changing a public gallery to protected, taking it offline, or deleting it blocks access through D1 first, then requests an immediate edge purge and schedules a retryable delayed purge. Purging remains active when the feature flag is off, so older entries can still be cleaned. Cloudflare does not provide an inventory of every edge copy; the short edge lifetime is an additional bound. Browser-cached copies cannot be remotely purged.
