# Media, publication, and maintenance

Package PD owns media streaming, publication readiness, D1-first deletion, provider cleanup, and usage reporting.

## Media request

`GET /media/:eventId/:photoId/:revision/:variant` validates the path, looks up a published event/photo/variant join in D1, checks the current event grant when protected, checks download permission, and only then asks R2 for the D1-derived key. The response streams the R2 body and never buffers it as an `ArrayBuffer`.

Public revisioned media is immutable. Protected media is private for one hour. Missing access classification is never treated as public.

## Publication

An event publishes only when it contains at least one photo and every visible photo is `variants_ready` or already `published`. Facial indexing can remain pending; it is optional and must not block a gallery. The publish operation promotes ready photos and increments the event revision.

## Deletion

Deletion changes the photo to `deleting` in D1 and creates one `delete_photo_media` job keyed by the photo ID. From that moment, media lookup returns 404 even if R2 or Vectorize is unavailable.

The maintenance runner fetches D1-derived R2 keys and vector IDs, deletes provider data in bounded batches, removes variant/face references, repairs affected partition counts, and marks the photo `deleted`. It also processes targeted `delete_face_vector` compensation jobs created when an indexer loses its D1 lease after a provider upsert. Failures return the job to `pending` with exponential delay; the fifth failed attempt is retained as `failed` for operator attention. A `running` claim expires after 15 minutes so an isolate crash cannot strand cleanup forever. Operations remain idempotent because a stale claim may safely repeat a provider delete.

## Integration points

- Call `registerMediaRoutes(app)` and `registerPublicationRoutes(app)` after global middleware registration.
- Invoke `runMaintenance(env)` from the scheduled handler added during release integration.
- Merge `publicationResources` into both i18next languages and mount `PublishPanel` in the admin event flow.
