# ADR-046: Optional public Sessions page

Status: accepted by the owner request on 2026-10-01. Extends ADR-028, ADR-041 and ADR-045.

## Decision

Add `sessionsPageEnabled` to public and admin site settings, defaulting to true. Migration 043 adds `site_settings.sessions_page_enabled`. An omitted owner PATCH field preserves the saved value.

Place the bilingual checkbox in Admin Settings > Website beside the global Galleries visibility switch. Keep individual Home membership in the Sessions editor; disabling the page does not change catalog content, order, enablement, or `showOnHome`.

When disabled, omit Sessions navigation and the Home view-all link. Resolve configured Home actions targeting `/services` to `#services`. Client navigation renders a localized unavailable-page message. The Worker returns HTTP 404 with noindex and no-store for `/services`, `/fr/services` and `/en/services`, including trailing slash variants. Localized session documents pass through the Worker before static assets; enabled pages retain their compiled HTML. If D1 availability cannot be read, session HTML returns 503 with noindex. Home and Contact retain their independent static fallbacks.

Omit the page and all language alternates from the sitemap and `llms.txt` when disabled. No dependencies are added. Existing short public settings/index cache lifetimes apply; changes may take those lifetimes to propagate.

The shared **Public pages** block in Admin Settings > Website groups Galleries, Sessions and About. About visibility now saves through an optional `aboutEnabled` field on the main settings PATCH. The About editor retains text/photo controls and omits visibility on its PATCH; omitted `enabled` preserves the stored About availability, while older clients can still provide it. No additional migration is required.

Public Galleries, Sessions and About links stay hidden until the settings response confirms enablement, including on settings failure. Home gallery promotions follow the same gate. Sitemap and llms omit optional Sessions/About entries when D1 settings are unknown and return no-store to avoid caching obsolete enabled entries; customer galleries remain absent from both documents in every state.
