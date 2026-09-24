# ADR-010: Wide photo mosaic and shared private-gallery favorites

Status: accepted by the owner request on 2026-09-24.

## Context

Uniform square thumbnails hid portrait/landscape composition and made a photo gallery feel cramped. The owner wants a generous, variable-height mosaic and a heart visible both in the grid and the photo viewer. The heart is a shared gallery-level selection, not a per-person reaction system. Public galleries must not offer it.

## Decision

- The gallery page may use a wider content area than the rest of the static website. Its responsive photo mosaic preserves each derivative's aspect ratio, uses tight gutters, and uses the existing viewer for full-size navigation. No external layout dependency is added.
- `photos.liked` is one D1 boolean per photo, default false. No visitor identifier, counter, or profile is recorded. The last authorized write wins. The state persists until explicitly changed or the photo/gallery is deleted.
- The photo-list API returns `liked` only as `true` for an unlocked protected gallery; public galleries always receive `false` and render no heart. The photo-list response remains `private, no-store` for protected galleries.
- `PUT /api/v1/galleries/:eventId/photos/:photoId/favorite` accepts and returns a strict `{ liked: boolean }` contract. The Worker requires a same-origin request, a currently valid gallery grant, a protected and available gallery, and a published photo belonging to it. It refuses public galleries even if called directly.
- Both grid and viewer use the same accessible heart component, backed by the photo-list query. Download-selection mode keeps hearts out of its tile actions.

## Consequences

Anyone holding the protected-gallery password can change the shared state, including clearing another visitor's heart. This is intentional and is communicated as a gallery-wide selection, not a personal favorite. There is no history or attribution. Migration `015_private_gallery_favorites.sql` is required before deploying the matching Worker. Existing photos begin unliked.
