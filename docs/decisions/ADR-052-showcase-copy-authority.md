# ADR-052: Repository-owned showcase descriptions and footer

Status: accepted through the owner's 2026-10-25 review corrections. Refines ADR-027 only for the explicitly enabled showcase.

## Context

Cadrora.com is the demonstration: Home explains the product flow, and the remaining public pages demonstrate the photographer's result. The existing navigation remains appropriate. Older D1 studio descriptions and footers were replacing the current product description and every page's localized metadata after hydration.

## Decision

- When the existing showcase gate is enabled and the profile supports demonstrations, use repository-owned profile descriptions and translated footer copy. Prefer explicit page descriptions, then the profile's localized page metadata, then its site description.
- Do not add fictional studio contact locations to showcase metadata or organization structured data. Contact itself still demonstrates the configured studio details.
- Repair the known previous Cadrora brand strings through the idempotent, showcase-only seed. Match the Cadrora identity and each old field independently; preserve unrelated or subsequently edited saved fields.
- Ordinary photographer profiles, including Atelier Giulia, retain exactly the existing owner-first description and footer behavior, configured service-area metadata, and page settings. This decision does not change their brand content or navigation.

## Validation

Run the SQL seed against fresh, legacy, edited and non-Cadrora fixtures. Verify FR/EN rendered description, Open Graph, Twitter metadata and footer for both builds, including Atelier owner overrides. Neither local seed tests nor a build prove that a production seed has run.
