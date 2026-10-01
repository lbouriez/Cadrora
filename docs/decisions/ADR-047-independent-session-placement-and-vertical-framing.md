# ADR-047: Independent session placement and vertical photo framing

Status: accepted by the owner's 2026-10-01 fix request. Extends ADR-028, ADR-041 and ADR-044.

## Decision

Keep the existing catalog fields and make their controls independent: `enabled` means show on Sessions, while `showOnHome` means include on Home. Public API publication uses their union and retains complete bilingual copy and published-variant requirements for custom cards. Home and its admin preview use only `showOnHome`; Sessions uses only `enabled`. Contact context accepts cards in either placement. A card is marked Hidden only when both flags are false. The global Sessions-page switch still controls its public route/navigation/sitemap, and never prevents Home placement or admin editing. Existing legacy fallback selections are preserved when the catalog is unavailable.

Extend default and nullable phone focal points with `top` and `bottom`, alongside left/center/right. Migration 044 copies existing values into expanded constrained columns, then replaces only the old framing columns. Catalog IDs, foreign keys, media variants and revisions remain intact. Shared rendering uses identical object positions for progressive preview and optimized layers, including the phone override and admin preview. Existing centered framing stays unchanged. No dependencies are added.

## Validation

Verify API union publication and custom completeness fences, Home-only rendering and Sessions exclusion, owner badges and Contact context, FR/EN selector save/reload, vertical progressive-layer framing, inherited phone framing and both profile builds. Exercise migration on existing framing and referenced media before applying it locally. Run check, unit tests and relevant desktop/mobile browser regressions before pushing.
