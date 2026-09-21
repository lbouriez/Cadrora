# ADR-004: Gallery metadata and session-scoped face-search results

- Status: accepted
- Date: 2026-09-21

## Context

The public viewer needs an optional information panel without exposing filenames, capture times, or dimensions when a photographer prefers a minimal gallery. Facial-search results also need to remain useful after the visitor leaves the find screen: the visitor should be able to review every possible match in the normal gallery and switch back to all photos without repeating local inference.

These conveniences must not turn facial search into a cross-event identity profile, upload the visitor image, persist an embedding in browser storage, or couple gallery availability to Vectorize.

## Decision

Add the event-level `showPhotoMetadata` setting, stored as `events.show_photo_metadata` and disabled by default for newly created events. When enabled, the full-screen viewer exposes a labelled information control showing only metadata already present in the authorized public-photo response: filename, event-local capture date, and pixel dimensions.

After a successful face search, store at most 2,000 unique matched photo IDs (the default per-event photo cap) in `sessionStorage` under a key containing the event slug. Do not store the selfie, face crop, embedding, score, related-moment result, or vector identifier. The gallery may use those IDs to offer an **All photos / Found for me** segmented control and preserve that filter in viewer URLs. Invalid or unavailable browser storage fails closed to the normal unfiltered gallery.

Keep every search, related-photo request, stored result key, and gallery filter scoped to one event. Vectorize continues to query only `face:{eventId}:generation:{generation}`, and D1 continues to validate every returned photo against that same event before responding. Nearby-moment requests run automatically for the direct matches and are deduplicated for presentation, but are not promoted to facial matches.

## Consequences

- A photographer explicitly decides whether photo metadata is visible per gallery.
- A result filter survives navigation within the current tab/session but disappears when the browser session ends. It can include every match in a default-cap gallery rather than truncating the result set to one API page.
- Someone with local browser access can inspect matched photo IDs, which are already present in authorized gallery URLs; no biometric template is added to browser storage.
- Search remains gallery-specific and cannot return, join, or filter photos from another event.
- Existing deployments require migration `006_event_photo_metadata.sql`; the release flow applies it before deployment.

## Alternatives rejected

- Always display metadata: removes photographer control and may reveal filenames or timestamps unexpectedly.
- Store embeddings or results in D1: creates unnecessary durable visitor-biometric or behavior state.
- Use `localStorage`: retains results beyond the intended browser session.
- Add nearby photos to the match filter: visually adjacent moments are useful context, but they are not facial-search matches.
- Search all event namespaces: violates the event-access and privacy boundary.
