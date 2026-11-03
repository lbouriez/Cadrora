# ADR-056: Optional owner-resolved Home photo preload

Status: Accepted, 2026-11-03, within the user's explicit approval of PERF-002 revision 1 in `cadrora-quality-2026-11-02`.

## Decision

The Cadrora editorial Home opts into `homeImagePreload: "full-width"` in its build profile. Only its generated Home documents carry the capability marker. Exact Home aliases `/`, `/fr`, `/fr/`, `/en`, `/en/` delegate through the Worker to the existing static asset, then optionally read the public site settings with a 250 ms deadline. Contact and other static marketing pages keep their existing routing. The unmarked Atelier profile performs no extra settings read or preload and retains its slider gates.

A successful, shared-schema-validated read selects the current published owner hero revision, or confirms that the compiled fallback is appropriate. Unknown published dimensions, invalid data, failure or timeout return the original useful static HTML without a photo hint. No gallery, authentication, remote service or successful D1 read is required to serve Home. The uncancellable late read has no side effects.

The document contains one responsive `imagesrcset`/`imagesizes` preload and a non-executable, escaped JSON snapshot of the existing public DTO. No admin-only data, secrets, grants or new API fields are serialized. The bootstrap or app consumes the snapshot exactly once through the existing validation boundary. Later refreshes use the existing API. Sharing the read prevents an older API cache entry from selecting a different image during startup. Documents on this optional path are `no-store, no-transform`, without ETag; media authorization and revision fences remain unchanged.

The shared `homeHeroSources` function and `95vw` sizing contract are used by both the hint and the full-width editorial `ProgressivePhoto`. The latter retains owner resolution, preview, decoding, error and reduced-motion behavior. Other images retain measured sizing. No `href` fallback is provided on the responsive hint, avoiding an incorrect preload in browsers without responsive-preload support; see the [HTML standard](https://html.spec.whatwg.org/dev/semantics.html#the-link-element). No dependency is added.

## Scope and tradeoffs

This supersedes asset-first routing only for the exact Home aliases. It does not approve or implement the broad server rendering/hydration proposal in ADR-049. React still renders the page; the hint removes image discovery from that dependency chain. Each opted-in document costs at most one optional settings query and up to 250 ms waiting. The usual static fallback remains mandatory. Local controlled measurements are not field Core Web Vitals or proof of provider latency.

The exact public Home GET/HEAD routes run after request identity/security headers and before auth/API middleware. This preserves their former independence from admin cookies, Access proofs and API rate limits. Every API, admin, gallery and media route retains the frozen middleware order and authorization; no wildcard bypass is added.

## Acceptance

Validate default and owner sources, missing/invalid/stalled reads, safe serialization, no read on unmarked profiles, both profile builds, responsive request reuse at 320/390/768/1440 px and DPR 1/2, client fallback startup gates, and comparable before/after measurements. Preserve admin content/photo/theme/language controls. No release or production claim follows automatically from these checks.
