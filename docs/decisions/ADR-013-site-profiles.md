# ADR-013: Build-time site profiles

Status: accepted, 2026-09-24. This refines the presentation choice in ADR-006; it does not change the single-tenant deployment model.

## Context

Cadrora's showcase and a photographer's site need different home/service presentation while sharing gallery, contact, admin, accessibility, and future design-system improvements. A permanent fork for each site would make those shared improvements difficult to carry forward. A runtime multi-tenant page builder would add unnecessary authorization and deployment complexity.

## Decision

- Select one typed, repository-owned site profile at **build time** with `CADRORA_SITE`. The default is `cadrora`; `atelier-giulia` is the first additional profile. Unknown identifiers fail the build.
- Shared components, routes, styles, translations, Worker and gallery behavior remain in the core. Profiles supply brand imagery, ordered home sections, FR/EN copy overrides, and semantic theme tokens. A profile may replace a marketing page component only when composition is insufficient; it must still use shared UI primitives and bilingual resources.
- D1 remains authoritative for owner-editable website, service, contact, theme, language, gallery, and analytics settings. A profile supplies compiled presentation/fallback content, never credentials or private contact data. The initial Atelier Giulia D1 brand seed updates only the untouched default row and never overwrites owner changes.
- A profile is not a security boundary. Every deployment has its own Worker, D1, private R2 buckets, Vectorize index, admin secrets, Turnstile widget, and exact hostname. The Atelier Giulia profile is pinned to `ateliergiulia.com` in the instance provisioner to prevent deploying that brand to the wrong target.
- The optional Atelier Giulia GitHub Action is account-scoped and off until a repository gate and protected environment are configured. It uses stable encrypted credentials and the existing idempotent instance provisioner. The original Cadrora Workers Builds deployment remains independent.

## Consequences

Core design and functional improvements reach both sites automatically. A deliberately overridden page requires manual reconciliation when its shared counterpart changes; prefer profile data and shared composition before an override. The two builds contain different public assets/copy, but both are produced from the same reviewed commit. Demo imagery in the initial Atelier Giulia profile is provisional and must be replaced with licensed studio work before it is presented as Giulia's portfolio. Cloudflare account-wide free allowances still apply to all resources within each account, not each profile.
