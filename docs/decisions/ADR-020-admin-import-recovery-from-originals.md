# ADR-020: Admin recovery of unfinished photo imports

Status: accepted by the owner request on 2026-09-25.

## Context

An interrupted browser import can leave D1 photo rows in `pending` after some variants have reached R2. The browser's IndexedDB journal is scoped to one browser profile and can be lost or unavailable. A fresh import rejects the same source files as gallery duplicates, while publication waits for every active photo to become ready. The owner must be able to recover without editing D1 or R2.

## Decision

- Add an authenticated admin read endpoint for a gallery's unfinished ordinary imports. It returns pending photo IDs, filenames, exact source SHA-256 hashes, and the variant names absent from D1. It excludes cancelled and replacement imports. The read-only demo remains denied.
- The admin import page offers **Finish unfinished photos** when the local journal cannot be resumed. The owner selects the exact original files, possibly the whole original selection. The browser matches source bytes by SHA-256, encodes only matching pending photos, uploads only D1-missing variants through the existing guarded and idempotent route, and calls the existing photo finalizer.
- A failed recovery can be retried by selecting the files again. Each attempt re-reads D1 and skips variants already recorded. Ready photos and their media are preserved. If the owner cannot supply an exact original, the UI identifies the unfinished filenames without deleting anything automatically.

## Consequences

Recovery still needs the exact original bytes for missing variants. The browser does not reconstruct them from small copies. Source files remain local; only their prepared variants use the normal upload path. The endpoint is admin-only and returns no media keys or private credentials. Gallery publication becomes available after all pending photos are finalized.
