# ADR-012: Gallery directory and progressive photo loading

Status: accepted by the owner request on 2026-09-24.

## Context

The public gallery directory needs an owner-controlled inclusion setting independent of publication and password access. Gallery cards should reflect creation order, not the date of the photographed event. A gallery can contain hundreds of photos, so a manual "load more" action and immediate full-resolution tile loads make browsing feel heavy. The selected cover photo also repeats the first visual inside the gallery header.

## Decision

- `events.show_on_gallery_page` defaults to true. The owner can toggle it for each gallery while creating or editing it. Only published, online galleries with this flag appear in public listing surfaces, including `/galleries` and the landing-page gallery section. The direct gallery URL and its normal access checks remain unchanged. `unlisted` still stays out of the directory regardless of this flag.
- `GET /api/v1/galleries` returns separately typed public and protected cards with `createdAt`; the client interleaves them by `created_at DESC, id ASC`. It includes a protected gallery's existing public event details but never its cover or photos. A separate text-only `GET /api/v1/galleries/:eventId/preview` keeps those details visible on a protected gallery's direct link even when its card is hidden. Updating a gallery does not alter its creation position.
- The gallery header is text and actions only; the cover remains on the directory card. Photo pagination keeps its existing bounded cursor API but fetches the next page when a sentinel approaches the viewport. A visible load-more control remains for accessibility and browsers without `IntersectionObserver`.
- Each mosaic tile reserves its aspect ratio and lazily loads the smallest prepared variant first. Once near the viewport and the preview has loaded, it requests responsive larger variants, then crossfades from the blurred preview. This does not change media authorization, privacy, or the full-screen viewer.

## Consequences

Migration `017_gallery_directory_visibility.sql` must precede the matching Worker. Existing galleries remain listed by default. Hiding a card is presentation, not a secrecy or access control: direct links keep working. For a gallery whose existence or details must not appear in the public index, use `unlisted` or `draft` as appropriate. The browser still holds metadata for loaded photo pages, while media bytes are requested lazily as the visitor scrolls.
