# ADR-014: Gallery-scoped deduplication for future imports

Status: accepted by the owner on 2026-09-25. Existing photos are intentionally not backfilled.

## Context

A resumed import reuses stable photo IDs, but choosing the same source file in a new import previously made another gallery photo and another set of R2 variants. Filenames are not reliable identities. A transient 503 during a variant upload could also pause a large import unnecessarily.

## Decision

- New ordinary imports calculate SHA-256 of the exact source bytes in the browser after format validation. The admin-only `POST /api/v1/admin/galleries/:eventId/photo-duplicates` accepts at most 50 hashes and returns only those held by active photos in that gallery. The browser removes duplicate files within its selection and across prior future imports **before** creating an import or consuming photo quota, and reports each skipped file.
- `photos.source_sha256` is nullable. Migration 019 leaves every existing photo null and adds a gallery-scoped partial unique index for non-deleting rows. It also prevents concurrent imports from silently creating the same new photo; a late conflict stops with a specific user-facing message, not a 500. Deleted photos free their hash so the source may be imported again.
- Old resumable import journals may omit the field and retain their original idempotence. A replacement staging import is exempt from deduplication so the photographer can intentionally upload the same source to replace a selected photo. The replaced photo's former hash is cleared because it no longer describes its current image; replacement hash tracking is deferred.
- The check is exact-byte equality. Re-exports, metadata edits, and different encodings are not considered duplicates. No cross-gallery comparison is made. No original file needs to be retained in R2 for the check.
- A variant `PUT` may be retried twice after a network failure or HTTP 429/500/502/503/504, with a short backoff and abort support. A request still pending after 90 seconds is aborted and treated as transient. A configuration 503 and all permanent 4xx responses fail immediately. The same Blob, photo ID, variant key, and checksum are reused; existing server idempotence protects an uncertain first attempt.

## Consequences

Only future ordinary imports benefit from cross-import deduplication. A file identical to a pre-migration gallery photo can still be added once after this change; subsequent exact reimports of that new row are skipped. SHA-256 computation reads one source file into browser memory per preflight worker, with preflight concurrency limited to two. The lookup requires an authenticated owner and never exposes a gallery-wide hash listing to visitors.
