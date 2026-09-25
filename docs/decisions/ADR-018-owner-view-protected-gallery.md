# ADR-018: Owner View Gallery access

Status: accepted by the owner request on 2026-09-25.

## Context

The admin dashboard already links to published, online galleries. For a protected gallery, the link reaches the visitor password screen even when the photographer has an authenticated owner session. Depending on the admin authentication mode, that session is not necessarily presented on public gallery and media requests.

## Decision

- The existing **View gallery** action first calls `POST /api/v1/admin/galleries/:eventId/view` for a protected gallery. The endpoint requires a verified owner `manage` session and the normal admin same-origin check. It rejects read-only demo sessions and draft, offline, or deleting galleries.
- The Worker reads the current gallery credential version and issues the existing signed, gallery-scoped, HttpOnly event-grant cookie. The response contains only the validated slug; the browser then navigates to the ordinary `/e/:slug` viewer. No gallery password or credential hash is sent to the browser.
- Public gallery and media routes continue to validate a current grant independently. The action does not make private photos public, broaden the demo allowlist, or bypass the gallery availability fence. Password rotation invalidates the grant through `accessVersion`.

## Consequences

The issued cookie has the same lifetime as a visitor gallery grant and can remain valid after the owner signs out of admin. It is scoped to one gallery and is replaced when another protected gallery is opened. Clearing site cookies or rotating that gallery's password revokes browser access; changing the gallery offline fences access immediately. The UI keeps the existing direct link for public galleries and the read-only showcase identity.
