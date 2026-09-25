# ADR-016: Per-gallery stored-media usage in admin

Status: accepted by the owner request on 2026-09-25.

## Context

The Site settings page reports total recorded photo storage, but the photographer cannot see which gallery uses it. Each uploaded variant, including an optional retained original, has a `photo_variants.byte_size` value in D1.

## Decision

- Add the required nonnegative `storageBytes` field to each event in the authenticated `GET /api/v1/admin/galleries` response. The public gallery APIs remain unchanged.
- Sum `byte_size` across every current `photo_variants` row joined through that gallery's photos, regardless of variant name or photo state. An empty gallery reports zero. This uses the same D1 accounting boundary as the Site settings total.
- Show the sum as a localized storage badge on each gallery row, using the existing decimal media-storage formatter. The badge updates when the gallery list is refetched.

## Consequences

The figure is D1-recorded gallery media, including variants from unfinished imports and originals still awaiting cleanup. It does not inspect R2 for stray objects, count shared model files, or report Cloudflare billing usage. No migration or dependency is needed.
