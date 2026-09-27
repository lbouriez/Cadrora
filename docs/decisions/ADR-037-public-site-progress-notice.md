# ADR-037: Owner-controlled site progress notice

Status: accepted, 2026-09-27. This extends the runtime site-settings contract in ADR-013 and ADR-027.

## Context

A studio may publish a working website before its content is complete. Visitors need a clear, temporary notice, and the owner needs to remove it without a new build. The public shell already reads `/api/v1/site` for the site name, descriptions, theme, and navigation policy.

## Decision

- Add nullable `construction_notice_enabled` to the singleton D1 settings row. Null means no profile seed has set it and is shown as off. The Atelier Giulia initial-settings script changes null to on once, so later owner edits win; other profiles remain off.
- Return `constructionNoticeEnabled` in the existing public and admin site-settings responses. Accept it in the existing owner PATCH; omitted values preserve the current state for older clients.
- Render one shared notice above the public header on public routes. The fixed visitor text is translated through the FR/EN resources. The notice does not block navigation, authentication, galleries, or Contact.
- Keep the static site useful if the settings read fails. No dedicated API, R2 object, remote asset, or Worker-first HTML route is introduced.

## Consequences

Changes become visible after the public settings cache expires, within about 60 seconds or on refresh. The notice appears only after the optional settings response resolves. The owner can turn it off from Site settings when the website is ready. The Atelier Giulia seed runs after migration 038 during its instance deployment.
