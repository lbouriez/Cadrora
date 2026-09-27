# ADR-034: Portfolio categories independent of services

Status: accepted by the owner's 2026-09-27 request. Revises the category and service coupling in ADR-033.

## Context

Portfolio collections can represent subjects that are not sold as services. Creating a category from the portfolio editor should not create an offer, price, or service image. A disabled service must not hide an otherwise published collection.

## Decision

- D1 owns bilingual `portfolio_categories`. Existing service labels are copied into categories by migration 033, keeping collection identifiers, slugs, photos, variants, covers, and publication states.
- Each collection references one category. The admin category selector can create a new FR/EN category without changing the service catalog. Both collection cards and detail headings use the category label.
- Portfolio list, detail, sitemap, and media publication depend on collection and photo state, independent of service enablement. Gallery service tags remain a separate fixed taxonomy.
- Gallery admin rows show their sharing classification and a separate password lock. Service cards reserve duration and prices for their detail modal.

## Consequences

Migration 033 rebuilds the portfolio tables to remove their service foreign keys while preserving D1 rows and media keys. It recreates storage accounting triggers after copying variant rows so the copy does not double count storage. Existing category labels no longer update when a service title changes. No dependency is added.
