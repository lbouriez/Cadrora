# ADR-008: Runtime website settings and optional contact map

- Status: accepted by the owner's 2026-09-23 implementation request
- Date: 2026-09-23

## Context

The photographer site needs editable contact coordinates, service visibility, visual presentation, and optional GA4 configuration without rebuilding static assets. The public site must still work during a D1/API outage. A service-area map must not silently contact Google, require Google Cloud setup for every installation, or imply a precise travel boundary.

## Decision

Store site name, contact details, enabled service keys, map centre/radius, and an optional GA4 Measurement ID in the singleton D1 `site_settings` row. The authenticated owner updates them through the validated site-settings API. The public API returns only intentionally public values and caches them briefly; the static client uses compiled profile defaults when that read fails. Blank contact strings intentionally hide a field; null indicates that the build-time fallback has not yet been overridden.

GA4 remains disabled by default. Only a valid `G-…` ID and explicit browser consent cause the public marketing-route client to load the Google tag. No gallery, face-search, admin, API, or media route is measured. Changing the ID does not require rebuilding the client. This replaces ADR-002's build-time GA4 configuration; the remaining showcase and read-only-demo decisions in ADR-002 stay in force.

The optional Google Maps Embed API iframe requires a public, referrer- and API-restricted key supplied at build time. Google Cloud billing activation is an operator choice, not a Cadrora deployment prerequisite. The Contact page shows service-area text and a Google Maps link without a key; with a key, it loads the iframe only after a visitor clicks. The admin sets centre latitude, longitude, and a travel radius in kilometres. Radius influences an approximate map zoom and appears in text; it is **not** a polygon or precise boundary drawn on the map. A true radius overlay would require a different Maps API and a separate cost/privacy decision.

Shared motion tokens and a reveal component provide restrained entrance animation on site sections and service cards, with an immediate static presentation when reduced motion is requested or IntersectionObserver is unavailable. Local repository-owned demo images avoid remote image dependencies.

## Consequences

- D1 migration `012_site_analytics.sql` adds runtime public settings; release scripts must migrate before serving the new Worker.
- The public website remains useful when D1, GA4, or Google Maps is unavailable.
- Operators must replace fictional fallback contact values before a real launch and provide their own appropriately licensed studio photographs.
- The Google Maps key is public client configuration, not a secret; restricting it by referrer and API is mandatory when enabled.
- External calls occur only after the respective visitor choice. Operators remain responsible for their own privacy notice and Google configuration.
