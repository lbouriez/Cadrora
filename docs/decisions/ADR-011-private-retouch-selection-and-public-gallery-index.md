# ADR-011: Private retouch selection and discoverable locked galleries

Status: accepted by the owner request on 2026-09-24.

## Context

A shared heart is a favorite, not a request for retouching. The photographer needs an actionable queue, original/best-quality download, and a way to return an edited photo without breaking its link. The public gallery index also needs to show that private galleries exist, without revealing their metadata before a password grant.

## Decision

- A protected, published photo has a second shared D1 boolean, `selected_for_retouch`, independent of `liked`. The check-mark control appears on private photo tiles and in the viewer; the heart continues to mean favorite. Both are last-write-wins gallery-wide choices. No guest identity, comment, or per-visitor collection is stored.
- `PUT /api/v1/galleries/:eventId/photos/:photoId/retouch-selection` accepts and returns a strict boolean selection. It requires same-origin proof and the current protected-gallery grant, and refuses public, offline, draft, deleted, and foreign photos.
- The admin selections workspace has separate **To retouch** and **Favorites** views of published photos in a private gallery, with individual and bounded batch downloads. The Favorites view is for inspection/download; replacement is offered in To retouch only. An owner download uses the retained original if present, otherwise the highest-quality derivative, regardless of the visitor download setting. A read-only demo can inspect the lists but cannot download or replace.
- The owner may upload exactly one replacement through the existing browser import pipeline. It is staged in the same gallery and then transactionally swapped onto the existing photo ID. Selection, favorite, position, capture time, and face references remain; the replacement's dimensions, MIME type, filename, variants, and revision become current. A D1 transaction guard prevents a stale concurrent swap. Old R2 variants are removed by a retryable `delete_replaced_media` job after a five-minute quiescence window. The staged replacement counts against storage until cleanup; the photo-count quota allows one staging slot.
- `GET /api/v1/galleries` adds `protectedGalleries: [{ id }]` for published, online protected galleries. The public site renders identical generic locked cards linking by opaque ID. Before unlock it reveals no private title, date, description, slug, or cover photo. The detail route and media routes still enforce the gallery grant independently.
- The public photo mosaic uses fewer, larger columns and the existing viewer becomes a near-full-screen blurred-backdrop lightbox on desktop while staying edge-to-edge on small screens. Full gallery cards are links, with a visible focus state.

## Consequences

Migration `016_favorite_photo_replacement.sql` must run before the matching Worker. Public viewers may learn the existence and count of published protected galleries; owners who need concealment should keep a gallery unlisted/draft or offline. Existing hearts remain unchanged; existing photos begin unselected for retouch. Replacing an image is not a new photo and does not delete its facial vectors, so the photographer must use the same subject/composition when face search is enabled or re-indexing must be added in a later change.

Curated showcase media uses seed-only R2 paths that are refreshed at every demo deployment. Those photos remain viewable and downloadable by an owner but are not eligible for replacement; only normal imported photos under their gallery-owned `events/.../photos/...` prefix are. The private showcase seed marks one retouch choice and one favorite to make the two admin views demonstrable.
