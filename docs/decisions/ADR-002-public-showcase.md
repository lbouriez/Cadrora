# ADR-002: Public showcase, read-only demo, and consented analytics

- Status: accepted
- Date: 2026-09-20

## Context

Cadrora's primary domain must demonstrate the whole product rather than show an empty shell. Visitors need a credible photographer website, public and protected example galleries, and an admin preview. Publishing admin credentials creates no safety boundary by itself, and a UI-only read-only mode could still be bypassed with direct API calls. Optional audience measurement must not leak gallery, administration, or facial-search activity.

## Decision

Ship generated, repository-owned showcase media and an idempotent opt-in seed controlled by `CADRORA_SEED_DEMO=true`. The same flag compiles the demo links into the public client and materializes the runtime demo-auth gate; every checked-in default is off. The deploy script uploads the image variants to private R2 before upserting and validating the matching D1 records. A normal photographer deployment leaves the variable unset and receives no sample events or demo login.

In password mode, expose a dedicated demo identity with published, non-secret credentials. It receives a separate one-hour stateless session, HMAC-signed with a domain-separated key derived from the stable `AUTH_PEPPER`. Add an explicit `Session.access` capability and enforce `read-only` on the server with an exact safe-read allowlist. Unknown routes fail closed; no demo request may create a D1 session or perform a provider mutation. Owner password and Cloudflare Access sessions retain `manage` capability.

Support optional GA4. The original build-configuration mechanism was replaced by owner-managed runtime site settings in [ADR-008](ADR-008-runtime-website-settings-and-maps.md). Default to no analytics. After explicit consent, load it only on the marketing-route allowlist; never measure gallery, admin, API, media, or face-search paths. Keep necessary storage usable when analytics is refused, and expose privacy settings from the footer.

## Consequences

- The official domain can demonstrate real D1/R2 gallery delivery without using client photographs.
- Published demo credentials are safe to share because the server capability, not credential secrecy or hidden controls, limits access.
- Adding a future admin read requires an explicit allowlist decision; it does not become demo-visible automatically.
- Demo sessions cannot be individually revoked, but expire after one hour and become invalid when `AUTH_PEPPER` rotates. They write no session records.
- GA4 remains disabled until an operator supplies a valid Measurement ID and each browser grants analytics consent.
- Showcase deployments re-upload a small, fixed generated asset set idempotently on release; real deployments do not.

## Alternatives rejected

- Reusing the owner session and merely disabling buttons: direct API requests would retain mutation authority.
- Giving the demo account Cloudflare credentials or API tokens: unnecessary and unsafe.
- Making an R2 bucket public: bypasses gallery authorization and the media route's cache policy.
- Tracking every route after consent: gallery and facial-search behavior remains outside the analytics purpose.
- Seeding every deployment by default: sample data is inappropriate for a real photographer installation.
