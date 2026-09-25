# ADR-015: Browser-local public hearts and per-gallery retouch closure

Status: accepted by the owner request on 2026-09-25.

## Context

Protected-gallery hearts already persist as one shared D1 state, visible on any device after gallery unlock. The owner confirmed this shared behavior. Public-gallery visitors need working hearts without recording them on the server. The photographer also needs to stop accepting retouch selections after finishing a gallery without losing the existing work queue.

## Decision

- Protected-gallery hearts retain the ADR-010 D1 boolean and grant-checked write. Anyone with the gallery password sees the same hearts across devices.
- Public-gallery hearts appear in the grid and viewer. Their photo IDs are stored per gallery in browser `localStorage`; they never call the favorite API or write to D1. Storage may be cleared by the visitor or browser. If storage is unavailable, hearts still work until the page is closed. The public photo API continues to mask D1 `liked` as false, and the Worker continues to reject public favorite writes.
- `events.retouch_selection_enabled` defaults on for existing galleries. A protected gallery's admin settings expose an on/off switch. When off, visitor check marks and their guidance disappear; the Worker rejects retouch writes even from a stale page. Existing `selected_for_retouch` values and the admin queue remain intact. Turning the switch back on restores selection controls and existing choices.
- Public gallery photo-download selection remains a separate temporary browser action and is unaffected.

## Consequences

Public hearts do not travel across devices or browsers and are not visible to the photographer. Migration `020_retouch_selection_enabled.sql` must run before deploying this Worker. No new dependency is added.
