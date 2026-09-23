# Media, publication, and maintenance

Package PD owns media streaming, publication readiness, D1-first deletion, provider cleanup, and usage reporting.

## Media request

`GET /media/:eventId/:photoId/:revision/:variant` validates the path, looks up a published event/photo/variant join in D1, checks the current event grant when protected, checks download permission, and only then asks R2 for the D1-derived key. The response streams the R2 body and never buffers it as an `ArrayBuffer`.

Both `download` and `original` variants require the gallery's `allow_downloads` flag, even if a caller crafts the URL. An allowed variant is an attachment with a sanitized filename whose extension follows the stored media MIME type, not the upload's original filename. The public photo API emits `downloadUrl` only when both the flag and a D1 `download` variant are present. Existing display variants alone do not make the official download control appear.

Public revisioned media is immutable. Protected media is private for one hour. Missing access classification is never treated as public.

## Publication

An event publishes only when it contains at least one photo and every visible photo is `variants_ready` or already `published`. Facial indexing can remain pending; it is optional and must not block a gallery. The publish operation promotes ready photos and increments the event revision.

`events.offline_at` is the reversible withdrawal fence. Public metadata, media resolution, crawler metadata, protected unlock, and face-search routes all treat a non-null value as unavailable. Taking a gallery offline leaves photo states and provider objects intact, increments the event revision, and increments any protected credential access version. Republishing clears the fence after the normal readiness check; deletion remains a separate lifecycle.

## Deletion

Deleting one photo changes it to `deleting` in D1 and creates one `delete_photo_media` job keyed by the photo ID. From that moment, media lookup returns 404 even if R2 or Vectorize is unavailable.

Deleting a whole gallery requires an exact, case-sensitive title confirmation at both UI and API boundaries. D1 immediately sets `offline_at` and `deleting_at`, revokes protected grants, cancels writable imports, and marks photos/faces as deleting. One idempotent `delete_gallery` job becomes available after a five-minute quiescence window. It selects every owned media key and vector ID through D1, deletes those provider records in bounded batches, removes dependent D1 records in foreign-key-safe order, and deletes the gallery last. It never deletes the shared `MODELS_BUCKET` artifacts.

The maintenance runner also processes targeted `delete_face_vector` compensation jobs created when an indexer loses its D1 lease after a provider upsert. Failures return jobs to `pending` with exponential delay; ordinary jobs retain the fifth failure as `failed` for operator attention, while a hidden gallery deletion keeps retrying so provider data is not silently stranded. A `running` claim expires after 15 minutes so an isolate crash cannot strand cleanup forever. Operations remain idempotent because a stale claim may safely repeat a provider delete.

## Integration points

The Site settings media-usage figure sums the recorded `photo_variants.byte_size` values in D1. It includes all gallery variants but not the separate model bucket, stray/unrecorded R2 objects, or other instances in the Cloudflare account. The admin formats this decimal-byte total as B, kB, MB, or GB (French: o, ko, Mo, Go) so small but nonzero galleries do not appear as `0 GB`. It is an instance quota indicator, not a Cloudflare billing-usage report.

- Call `registerMediaRoutes(app)` and `registerPublicationRoutes(app)` after global middleware registration.
- Invoke `runMaintenance(env)` from the scheduled handler added during release integration.
- Merge `publicationResources` into both i18next languages and mount `PublishPanel` in the admin event flow.
