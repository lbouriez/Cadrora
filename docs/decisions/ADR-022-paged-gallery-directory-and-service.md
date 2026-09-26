# ADR-022: Paged gallery directory and optional gallery service

Status: accepted by the owner's 2026-09-26 request.

## Context

The public gallery directory loaded every listed gallery in one API response. That grows with the catalogue and makes the initial page unnecessarily heavy. Visitors also cannot see what kind of session a gallery represents until opening it.

## Decision

- `GET /api/v1/galleries` returns at most 24 entries by default, with a maximum requested page size of 48. A keyset cursor orders public and protected entries together by `starts_at DESC, id ASC`. It carries the access filter, date, and ID. A cursor used with a different filter is rejected. The response contains `events`, `protectedGalleries`, and `nextCursor`.
- The directory fetches the next page near the scroll boundary. A visible button provides a manual fallback and retries a failed page. The home page requests only the newest 12 public entries, then applies its configured 1–12 display limit.
- Galleries have an optional `service` value. The fixed choices are wedding, family, portrait, maternity, brand, work, kids, events, and other. Existing galleries start with no service. Public and protected listing cards show a localized category tag when set; a protected card still never exposes private media.
- The listing query uses a partial D1 index over published, online, listed galleries in event-date order. An event-date edit can move an item between pages; a visitor refreshes the directory to see the new order.

## Consequences

Migration `025_gallery_service_and_directory_index.sql` must run before the matching Worker. API clients must consume `nextCursor` and not assume a single response is the full directory. Admin create/update and public/admin event schemas include the nullable service. No new dependency is required.
