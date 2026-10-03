# ADR-048: Static not-found documents and explicit dynamic shells

Status: Accepted in the October 2026 public-site improvement plan.

## Context

The global single-page fallback returned HTTP 200 for arbitrary URLs, including unsupported localized gallery directories. These pages appeared indexable and displayed a generic foundation screen. Public marketing documents must remain asset-first, and gallery/admin authorization must remain in the Worker.

## Decision

Use Cloudflare's `404-page` asset behavior with build-generated root, French, and English 404 documents containing noindex metadata and a home link. The React wildcard renders the same localized not-found intent. Generate the real unprefixed `/galleries` document with noindex metadata.

Vite development retains its SPA fallback because localized documents are generated after builds. Preview and deployment use the built 404 behavior; HTTP status regression tests therefore run against preview.

Only recognized dynamic `/e/*` and `/admin/*` client routes receive the static root shell from the Worker, after existing authorization middleware. API/media failures retain their structured errors. Unknown routes keep the asset 404 response. Do not broaden `run_worker_first` to all marketing traffic.

## Validation and consequences

Built-profile tests verify HTTP 404, localized fallback content, known static pages, and unindexed galleries. Unit tests constrain the dynamic route allowlist; existing authentication tests verify its middleware boundary. New dynamic client routes must be registered in both the client router and this allowlist. Localized HTML retains `Cache-Control: no-transform` to prevent automatic third-party script injection.
