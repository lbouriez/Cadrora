# ADR-009: Original-file delivery and gallery covers

Status: accepted on 2026-09-24 by the owner request to complete original uploads and admin-managed covers.

## Context

The gallery setting `keep_originals` existed, but browser imports uploaded only five re-encoded copies. Gallery cards also used demo artwork selected by slug even though `cover_photo_id` existed in D1. A downloadable copy was absent for some older/demo photos despite the gallery permitting downloads.

## Decision

- A new import snapshots `keepOriginals` in D1 and the browser journal. If enabled, each JPEG, PNG, or WebP source file is uploaded byte-for-byte as an `original` R2 object in addition to five stripped display/download variants. The photo cannot finalize until that original and all five variants are recorded. Imports begun before this change default to no original. The 100 MB binary-upload limit also applies to each source original.
- Original delivery is subordinate to gallery downloads. The admin presents it only when downloads are enabled; the Worker rejects an invalid enabled-original/disabled-download combination and clears original delivery when downloads are turned off. Changing either setting affects future imports and whether stored originals may be served now. It does not retroactively create or automatically remove prior originals. If gallery downloads are enabled and an original exists while `keepOriginals` is on, the public photo uses it. Otherwise its `/download` URL resolves to the prepared download variant or the largest available display copy. Direct `/original` access requires both settings, even when an object remains stored.
- When either option is disabled, admin settings query D1 for remaining `original` variants and retain a warning while any remain. The owner may separately cancel unfinished original imports from the warning. An explicit, confirmed action queues `delete_gallery_originals` in `maintenance_jobs` only when those imports have finished or been cancelled. After a five-minute in-flight-upload grace period, the runner deletes only D1-derived original R2 keys in bounded batches before removing their matching D1 variant rows. Failures are retryable, and an active cleanup prevents re-enabling original delivery. Prepared copies and model objects are never cleanup targets. Cadrora is not an archive of source files.
- Original files are unchanged and may contain GPS, camera serials, comments, and other source metadata. Only derived copies are metadata-stripped. Admin copy, privacy guidance, and cost examples must say so.
- For EXIF-rotated photos, the photo declaration keeps displayed dimensions while the unchanged original variant records the camera's raw pixel dimensions.
- Download and original responses are `private, no-store` because the relevant gallery settings can change. Already saved files cannot be revoked. Display variants retain their existing public/protected cache behavior.
- The owner chooses a ready photo through an authenticated, paginated admin cover picker. Its thumbnails are served from private R2 through an admin-only, no-store route. Public gallery list/detail responses expose a revisioned `coverPhotoUrl` only when the selected photo is published and its medium variant exists. Cards render that photo or a neutral theme-based placeholder; no slug-specific demo images are selected by code.

## Consequences

Migration `013_original_media.sql` stores each import's original choice and permits PNG originals in `photo_variants`; migration `014_original_cleanup.sql` adds the durable cleanup job kind. Originals consume additional R2 storage and transfer operations. Protected gallery access still governs media, while public gallery downloads are available to anyone with that gallery's public URL.
