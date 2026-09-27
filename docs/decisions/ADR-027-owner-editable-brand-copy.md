# ADR-027: Owner-editable name, description, and footer

Status: accepted, 2026-09-26. This refines the boundary in ADR-013 for a small set of owner-managed brand text.

## Context

The site name was already in D1, but descriptions and the footer line were compiled into each site profile. Requiring a code change for a short footer edit was unnecessary. At the same time, the owner wants the Home page to remain deliberately hand-customized in code.

## Decision

- Retain `site_name` as the single runtime site name and expose it in the existing public/admin settings contracts.
- Add nullable, schema-validated bilingual `site_copy` JSON to D1 for the French/English description and the short footer tagline. Existing API clients may omit `siteCopy` on PATCH; this preserves the stored value. Empty tagline means the footer shows just copyright and site name.
- Keep profile copy as fallback for an unavailable D1/API and for untouched installations. Seed the existing Atelier Giulia and Cadrora showcase descriptions/footer only when `site_copy` is null. New standalone instances use the neutral `studio` profile and its guarded seed. Profile imagery, icons, and Home page composition/text remain code-owned.
- Update browser metadata after `/api/v1/site` resolves and use runtime values in `/llms.txt`. The deployed static HTML and social previews continue to use `profile.json`; changing those requires a build. The admin and documentation must say this clearly.

## Consequences

Owners can adjust naming, browser description and footer in both languages without a deployment. D1's public settings cache can delay visibility for 60 seconds. Static crawlers and link previews retain build-time metadata, preserving the current static-asset hosting path and performance. Logo/icon upload and multi-format derivative generation remain a separate feature.
