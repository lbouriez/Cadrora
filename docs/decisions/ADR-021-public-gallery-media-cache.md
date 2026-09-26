# ADR-021: Public gallery media cache behind D1 access control

Status: accepted on 2026-09-26.

## Context

Public gallery display variants currently require a Worker D1 lookup followed by an R2 read on every uncached request. A gallery can later become protected or offline, so caching the outer media route would bypass the current access decision. Browser caches cannot be purged remotely.

## Decision

- The default Worker entrypoint has Workers Caching disabled and still resolves every media request against D1. Only a published public display variant is forwarded to the named `PublicMediaCache` entrypoint; downloads, protected variants, and failed D1 lookups never enter it.
- The inner entrypoint receives only a D1-derived R2 key, gallery ID, and MIME type as props. It strips request credentials and query parameters, validates the key scope, and caches a successful R2 response for five minutes with a gallery cache tag. The browser receives a separate one-minute cache lifetime.
- A public-to-protected transition, offline withdrawal, or deletion writes a `purge_gallery_cache` maintenance job in the same D1 batch as the access fence. The request immediately attempts a purge by both gallery tag and media path prefix. The job remains pending for a second purge after five minutes, allowing already-running public reads to finish. Rejected or unavailable purges stay in the D1 outbox for scheduled retries. Purge errors never restore access.
- The purge result confirms Cloudflare accepted the global invalidation. Cloudflare does not expose an inventory of all edge copies; the five-minute TTL bounds any residual edge copy while the D1 gate prevents it from being served through the application. Existing browser copies from before this change can persist under their original lifetime.

## Consequences

- Public cache hits avoid R2 but still pay the D1 authorization lookup and default Worker invocation.
- A purge failure remains visible as a pending maintenance job with `last_error` and retries without a fixed attempt limit. A retry can safely repeat a successful purge.
- The cache is scoped to the Worker instance and named entrypoint. Site profiles inherit this behavior without sharing gallery data.
