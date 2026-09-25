# ADR-017: Remove the gallery-count limit

Status: accepted by the owner request on 2026-09-25.

## Context

The number of galleries is not a Cloudflare Free quota and contributes little to storage usage by itself. The owner wants Site settings to focus on controls that meaningfully constrain stored media and face vectors.

## Decision

- Remove the gallery-count setting, its `MAX_EVENTS` Worker variable, and the count check on gallery creation. Keep the separate per-gallery photo limit, media-byte limit, and face limits.
- Remove gallery count from the Site settings quota response and usage display. The gallery list remains the place to see existing galleries.
- Retire the former D1 owner-limit column in a follow-up migration only after the Worker no longer reads it. This keeps the prior Worker compatible while the first deployment is in progress.

## Consequences

Creating a gallery no longer fails solely because a count has been reached. Cloudflare usage and billing still depend on actual media, database, request, and search activity; the remaining application limits are not an account-wide billing guarantee.
