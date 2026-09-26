# Media, publication, and maintenance

Package PD owns media streaming, publication readiness, D1-first deletion, provider cleanup, and usage reporting.

## Media request

`GET /media/:eventId/:photoId/:revision/:variant` validates the path, looks up a published event/photo/variant join in D1, checks the current event grant when protected, checks download permission, and only then asks R2 for the D1-derived key. The response streams the R2 body and never buffers it as an `ArrayBuffer`.

Both `download` and `original` variants require the gallery's `allow_downloads` flag, even if a caller crafts the URL. Direct `original` access also requires `keep_originals`. An allowed variant is an attachment with a sanitized filename whose extension follows the stored media MIME type, not the upload's original filename. The public photo API prefers an available original while both settings are enabled. Otherwise `/download` resolves the 3840-pixel prepared copy, or the largest available display variant for an older photo. It never gives access to a variant outside the same published photo/gallery. Download/original responses are `private, no-store`; display-cache rules are unchanged.

The owner-only selections workspace is separate from visitor downloads. It shows distinct retouch and favorites lists for private galleries; only selected-for-retouch photos can be replaced. Its authenticated, manage-only attachment route chooses a retained original or the best prepared variant even if visitor downloads are disabled. One edited file is uploaded through the standard import journal and swapped onto the existing photo ID only after the import completes. A transactional D1 guard rejects a stale swap; the existing heart, retouch selection, order, capture instant, and face references persist. The old R2 variants are deleted by a retryable `delete_replaced_media` job after five minutes. Replacements stage an additional copy and therefore require temporary storage headroom; migration 016 adds their columns and the cleanup job kind.

Original delivery is a subordinate gallery choice, never an archival setting. `GET /api/v1/admin/galleries/:eventId/originals` reports the D1 count and bytes of retained originals, unfinished original imports, and cleanup state. A warning remains in admin settings whenever the gallery no longer offers originals but D1 still records any. An owner-confirmed `POST .../originals/abandon-imports` can cancel unfinished original imports; normal browser cancellation also updates D1. An owner-confirmed `POST .../originals/cleanup` is blocked while an original import is unfinished and queues a durable maintenance job. It fences access through the gallery settings first; after five minutes for in-flight uploads, the runner deletes at most 100 D1-derived original R2 keys per batch, then their matching variant rows, and retries on failure. Re-enabling original delivery is refused during active cleanup. Generated variants are never removed by this job.

Public revisioned display media passes through the D1 access check on every Worker request, then uses the named `PublicMediaCache` entrypoint for a five-minute edge cache of successful R2 reads. The default Worker entrypoint is never cached. Downloads bypass the edge cache. The browser cache lifetime for public media is one minute; protected media is private for one hour. Missing access classification is never treated as public. See [ADR-021](../decisions/ADR-021-public-gallery-media-cache.md).

Public display responses include `X-Cadrora-Media-Cache` for operations: the inner entrypoint's Cloudflare cache status, `unknown` if unavailable, or `fallback` when the Worker reads R2 directly. This distinguishes an edge cache HIT from a safe fallback without exposing credentials.

## Publication

An event publishes only when it contains at least one photo and every visible photo is `variants_ready` or already `published`. Facial indexing can remain pending; it is optional and must not block a gallery. The publish operation promotes ready photos and increments the event revision.

The publication summary remains available for an empty draft gallery: its aggregate photo counters are zero, never SQL `NULL`, so the admin can show readiness before the first import.

`events.offline_at` is the reversible withdrawal fence. Public metadata, media resolution, crawler metadata, protected unlock, and face-search routes all treat a non-null value as unavailable. Taking a gallery offline leaves photo states and provider objects intact, increments the event revision, and increments any protected credential access version. Republishing clears the fence after the normal readiness check; deletion remains a separate lifecycle.

Public-to-protected, offline, and delete operations enqueue a `purge_gallery_cache` job transactionally with the D1 fence and attempt an immediate gallery-tag purge. Failed purges remain retryable in maintenance. D1 stops serving cached media as soon as the fence commits, even if edge invalidation fails; a five-minute TTL bounds edge leftovers. Cloudflare cannot enumerate all edge copies to prove physical removal.

## Deletion

Deleting one photo changes it to `deleting` in D1 and creates one `delete_photo_media` job keyed by the photo ID. From that moment, media lookup returns 404 even if R2 or Vectorize is unavailable.

Deleting a whole gallery requires an exact, case-sensitive title confirmation at both UI and API boundaries. D1 immediately sets `offline_at` and `deleting_at`, revokes protected grants, cancels writable imports, and marks photos/faces as deleting. One idempotent `delete_gallery` job becomes available after a five-minute quiescence window. It selects every owned media key and vector ID through D1, deletes those provider records in bounded batches, removes dependent D1 records in foreign-key-safe order, and deletes the gallery last. It never deletes the shared `MODELS_BUCKET` artifacts.

The maintenance runner also processes targeted `delete_face_vector` compensation jobs created when an indexer loses its D1 lease after a provider upsert. Failures return jobs to `pending` with exponential delay; ordinary jobs retain the fifth failure as `failed` for operator attention, while a hidden gallery deletion keeps retrying so provider data is not silently stranded. A `running` claim expires after 15 minutes so an isolate crash cannot strand cleanup forever. Operations remain idempotent because a stale claim may safely repeat a provider delete.

## Integration points

The Site settings media-usage figure sums the recorded `photo_variants.byte_size` values in D1. It includes all gallery variants but not the separate model bucket, stray/unrecorded R2 objects, or other instances in the Cloudflare account. The admin formats this decimal-byte total as B, kB, MB, or GB (French: o, ko, Mo, Go) so small but nonzero galleries do not appear as `0 GB`. It is an instance quota indicator, not a Cloudflare billing-usage report.

The admin gallery list also reports `storageBytes` per gallery. Each value sums every D1-recorded variant for the gallery's photos, including the optional original and variants of unfinished imports. Its badge uses the same decimal formatter. Empty galleries show zero; objects no longer recorded in D1 are outside this count.

- Call `registerMediaRoutes(app)` and `registerPublicationRoutes(app)` after global middleware registration.
- Invoke `runMaintenance(env)` from the scheduled handler added during release integration.
- Merge `publicationResources` into both i18next languages and mount `PublishPanel` in the admin event flow.
