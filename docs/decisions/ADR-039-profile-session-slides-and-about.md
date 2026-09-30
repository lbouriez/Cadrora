# ADR-039: Profile presentation for Home sessions and an owner-managed About page

Status: accepted, 2026-09-29; Home presentation amended 2026-09-29. This extends ADR-013, ADR-028, and ADR-038.

## Context

Atelier Giulia needs a full-screen, animated Home presentation of the same sessions the owner already manages. A separate Home photo catalog would duplicate content, upload work, and publication state. Both site profiles need a photographer About page, with different visual presentations and one shared admin workflow.

## Decision

- Use **Sessions** / **Séances** throughout the admin photography catalog as well, including settings sections, editor actions and feedback, Home limits and destinations, gallery session labels, and media inventory scope labels. Existing API routes, translation keys, and storage identifiers retain `services` for compatibility.
- Keep the shared public navigation and route components. A build-time site profile may set navigation order and select the `session-slides` Home presentation; the default Cadrora presentation remains its existing service cards. The menu label is Sessions / Séances in both languages. The session route stays `/services` as an implementation detail, without promising it as a permanent public contract.
- The Home presentation reads `/api/v1/services`, filters to enabled `showOnHome` sessions, retains admin order, and applies `homeServicesLimit`. It uses each session's published image sources and localized copy. Each session occupies a full-height panel in normal page flow. One vertical wheel, trackpad, touch, or keyboard gesture moves at most one panel and settles it fully before another gesture can advance; the last step reaches the footer. A shared enter-on-view transition reveals copy; the existing reduced-motion preference removes that transition. There is no automatic advance, carousel control, Home-specific session upload, or new service model.
- Add `/about` to the shared public router and an **About** admin tab. The owner controls visibility and bilingual title, body, and image description through shared localized fields. The page uses the same prepared marketing image upload, revision, R2 validation, cache, and cleanup flow as services. `about-hero` is a reserved media owner excluded from service catalogs. There is no original/download variant.
- D1 stores `about_enabled`, validated `about_copy`, and `about_image_enabled`. The public site settings response includes the visible image revision and recorded responsive widths. Disabling the page removes its navigation item, redirects `/about` to Home, and fences its uploaded image routes. The compiled profile supplies copy and a static image fallback when no owner override is active or D1 is unavailable.
- Map Atelier Giulia's brief palette onto existing semantic theme tokens and render its Home and About as immersive layouts. Cadrora uses the shared About content and its normal editorial layout. The navigation mechanism, i18n, menu controls, accessibility controls, and admin data flow remain shared.

## Consequences

The Home appearance follows the configured sessions, so the owner's photos and copy determine the final result. Existing 1280 px session images still work and gain a 2560 px large variant when replaced. The About page adds one migration and two owner-only admin routes. No new dependency is required.
