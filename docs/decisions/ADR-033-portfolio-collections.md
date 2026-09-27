# ADR-033: Portfolio collections instead of per-service photo sections

Status: accepted by the owner's 2026-09-27 iteration request. Revises ADR-032.

## Context

The first portfolio implementation placed individual photos in one section per service. The owner wants an editorial collection to behave like a gallery: its own card, title, description, cover, photo order, and detail page, managed as a unit in the admin. Customer-only controls do not belong in a portfolio.

## Decision

- D1 owns `portfolio_collections`. A collection has a stable ID, unique slug, service, bilingual title and description, order, publication state, and optional chosen cover. Existing portfolio photos are backfilled into one collection per service. New photos belong to exactly one collection.
- `/portfolio` displays published collections as the same image-led card family used by the customer gallery directory. `/portfolio/:slug` reuses the gallery mosaic layout, progressive responsive images, and viewer. The portfolio viewer has no password, hearts, retouch selection, metadata, or download control. Collection pages can be indexed and appear in the sitemap; customer galleries remain excluded.
- The admin Portfolio tab lists collections. The owner can create and edit bilingual copy, slug, service, cover and order, add multiple photos, edit photo descriptions and order, retry a pending upload, publish or hide a collection, and delete it. Publication requires at least one fully prepared photo. The existing four-size browser encoder remains shared; no untouched source or download-sized gallery variant is retained. Public media checks both photo and collection publication and service visibility.
- Collection deletion removes the D1 publication and rows before retryable cleanup of only those D1-derived R2 keys. The old photo endpoints remain, but photo creation now requires a collection ID and derives its service from that collection.
- The Cadrora showcase seeds five fictional collections with two generated photographs each. Tracked WebP variants, R2 objects, and D1 metadata are generated from the same bytes by the opt-in demo seed script. Studio deployments do not receive these examples.
- Service dialogs keep duration, indicative price, explanation, and included items, without a portfolio link. Clearly marked sample duration and price values appear for unedited built-in services on either site profile; owner-entered service copy replaces them.

## Consequences

Migration 032 is additive and preserves existing uploaded portfolio photos. No new runtime dependency or Worker-side image processing is introduced. The static marketing HTML remains available during a D1 outage; collection cards and media require D1. The existing portfolio API response shape changes from photos to collections, in step with the public client deployment.
