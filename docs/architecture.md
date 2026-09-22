# Cadrora architecture

## Context and goals

Cadrora serves photo galleries from a single Cloudflare deployment that a photographer can operate without a terminal after installation. The architecture keeps public assets cheap, private media authorized, image processing out of the Worker CPU budget, and optional facial search isolated from gallery availability. The internal D1 schema retains its original `events` table name to avoid a destructive storage migration; every HTTP route and user-facing label uses “gallery”.

Non-goals for v1 include SSR, video, RAW/HEIC import, payment, a CLI product, multi-photographer tenancy, microservices, and cross-event biometric profiles.

## System view

```mermaid
flowchart LR
  A[Photographer browser] -->|admin API, variants| W[Hono Worker]
  V[Visitor browser] -->|public API or scoped grant| W
  V -->|local selfie to embedding| V
  W --> D[(D1 reference state)]
  W --> R[(Private R2 media)]
  W -. optional embeddings .-> X[(Vectorize)]
  W --> S[Static React assets]
  M[(Immutable model bucket)] -->|lazy model download| A
  M -->|lazy model download| V
```

The React SPA is static. It contains a public photographer website at `/` and `/contact`, event galleries under `/e/*`, and the browser-operated admin surface under `/admin/*`. Cloudflare invokes the Worker first for `/api/*`, `/media/*`, authenticated admin pages, model artifacts, and event pages under `/e/*`. Event pages pass through the Worker only so recognized crawlers can receive a narrow metadata shell; ordinary navigation delegates to the static-assets binding and its SPA fallback. The public landing and contact pages remain static, have no external runtime dependency, and stay useful if the gallery API is temporarily unavailable.

## Runtime responsibilities

### Browser

- React renders public and admin flows with shared components and FR/EN resources.
- Build-time `VITE_*` values provide the intentionally public photographer name and contact coordinates; they never contain secrets.
- TanStack Query owns remote state.
- Import workers decode images, normalize orientation, remove private metadata, encode variants, and upload bounded concurrent streams.
- Optional ONNX models run locally. A visitor selfie is never uploaded.

### Worker

- Hono applies request identity, error conversion, headers, auth context, Turnstile scoping, rate limiting, routing, and cache policy.
- Routes validate both input and output with shared Zod schemas.
- The Worker performs authorization and orchestration only; it does not decode images or run ML.
- Media object keys come from D1 state, and R2 bodies are streamed.

### Persistence

- D1 is the source of truth for visibility, lifecycle, authorization versions, object metadata, and pending maintenance.
- R2 stores private media and immutable model artifacts.
- Vectorize stores event/generation-scoped embeddings when configured.
- Since these services do not share a transaction, `maintenance_jobs` is the durable outbox for deletion, purge, and reconciliation.

## Key flows

Import declares an import and photo records, encodes bounded chunks in the browser, upserts each variant, optionally adds face references, finalizes photos, and finally publishes an event. Every step is retry-safe on natural keys.

Protected access exchanges an event password plus Turnstile proof for a grant scoped to the event and current `accessVersion`. Admin and event password verifiers are domain-separated HMAC-SHA-256 values keyed by a Worker-only `AUTH_PEPPER`; this avoids the former PBKDF2 cost exceeding the Workers Free 10 ms CPU allowance. The same grant is checked for metadata and media. Password rotation increments the version. The reserved seeded demo credential may bypass verification only when the explicit showcase gate is enabled.

Taking a gallery offline sets a reversible D1 fence and revokes existing protected grants without removing provider objects. Permanent deletion is separate: it sets `deleting_at`, cancels open imports, freezes photos, and revokes access immediately. After a five-minute quiescence window, a retryable `delete_gallery` job deletes only the R2 keys and Vectorize IDs derived from that gallery's D1 rows, then removes dependent D1 records and the gallery itself. Shared model objects are never gallery-owned and are never deleted by this path.

## Deployment shape

`wrangler.jsonc` defines one production Worker, a separately named preview Worker, static assets, D1, private R2 bindings, required secrets, and bounded configuration vars. Local development uses emulated/persisted resources. Release automation builds the chosen environment, migrates its `DB` binding remotely, and deploys it; preview and production resources and secrets remain separate.

## Related decisions

- [`ADR-001-stack.md`](decisions/ADR-001-stack.md)
- [`technical/contracts.md`](technical/contracts.md)
- [`technical/public-website.md`](technical/public-website.md)
- [`implementation-plan.md`](implementation-plan.md)
