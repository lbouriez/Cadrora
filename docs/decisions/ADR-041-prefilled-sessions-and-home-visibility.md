# ADR-041: Prefilled sessions and direct Home visibility

Status: accepted by the owner's 2026-09-29 request. This updates ADR-028 and ADR-039.

## Context

The five built-in photography sessions omit distinct Maternity, Portraits, and Couples offerings. The separate Home count means a session can be marked for Home yet remain hidden solely because it falls after the count in catalog order.

## Decision

- Add Maternity, Portraits, and Couples as built-in, owner-editable sessions with bilingual example copy and replaceable compiled sample photos. The initial migration appends them after the existing built-ins, enables them, and marks them for Home without changing existing session rows or their order. Keep the legacy enabled-key fallback list aligned.
- Increase the shared catalog maximum from 30 to 40 so an instance already near the previous maximum can accept the three new built-ins and still edit their order.
- Home displays every enabled session marked `showOnHome` in admin order. Remove `homeServicesLimit` from the public and admin settings contracts, the admin form, and both Home presentations. Migration 040 drops the unused D1 column. The Recent stories gallery count remains independent.
- Keep the public HTML static and the existing `/api/v1/services` and media routes. The built-in photos are compiled assets; owner uploads continue to use versioned D1/R2 media rows. No dependency is added.

## Consequences

Owners can decide Home membership with one switch per session. Existing sites gain three visible examples when migration 040 runs, and can hide or replace each one in the Sessions editor. A site whose session catalog API is unavailable still has compiled bilingual examples and photos.

The 2026-09-30 catalog copy cleanup gives the existing `family` session a distinct **Famille** / **Family** title, family-specific descriptions, and a dedicated compiled sample photo across site profiles. Its key, D1 row, ordering, and owner overrides are unchanged.
