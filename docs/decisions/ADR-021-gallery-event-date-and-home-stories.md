# ADR-021: Event-date gallery ordering and home-page stories

Status: accepted by the owner's 2026-09-26 request.

## Context

The public directory showed each gallery's event date but sorted cards by the date the gallery was created in Cadrora. Imported older work therefore appeared ahead of newer photographed events. The home page also displayed every public gallery, which grows unwieldy as the catalogue grows.

## Decision

- The public gallery index and shared card component order public and protected gallery cards by `starts_at DESC, id ASC`. This replaces the creation-time ordering in ADR-012. The date shown on a card and its position now use the same event date. Editing an event date can change its position.
- The singleton site settings store whether the home-page gallery section is visible and a maximum card count from 1 to 12. Defaults are enabled and 6. The owner edits both under **Recent stories** in the **Home** section of Site settings. The limit applies after event-date sorting and only on the home page. The complete `/galleries` directory remains available through bounded pages, as defined in ADR-022.
- The home page keeps its gallery-list request independent of the optional site-settings read. It hides the section when disabled. If site settings fail, the static site falls back to showing at most 6 public cards. The gallery directory and direct links are unaffected.

## Consequences

Migration `024_home_gallery_settings.sql` must run before serving the matching Worker. Both public and admin site-settings responses include the validated home-gallery settings. The public settings response keeps its existing short cache lifetime, so saved changes may require a refresh on an already open page.
