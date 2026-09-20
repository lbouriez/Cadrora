# ADR-001: Cloudflare full-stack foundation

- Status: accepted
- Date: 2026-09-20

## Context

Cadrora needs a static, fast gallery; a small authenticated API; private object storage; resumable browser-side image work; shared validation; and optional vector search. One maintainer should be able to deploy and operate it without a server fleet.

## Decision

Use React 19 and TypeScript 6 as the UI/runtime language, Vite 8 with the official Cloudflare Vite plugin, and one Hono Worker. Use raw D1 SQL for reference state, private R2 for media/models, and optional Vectorize for event-scoped embeddings.

Use these application libraries:

- Zod for one validation contract shared by browser and Worker.
- TanStack Query for remote state and invalidation.
- i18next/react-i18next for FR/EN from the first UI.
- React Router for accessible client-side route composition and SPA deep links.
- `onnxruntime-web` 1.30.0 for optional, local facial inference. It is dynamically
  loaded only by the find route, uses the package's WASM entry by default, and may
  use WebGPU only when explicitly requested and both WebGPU and WebAssembly JSPI
  are supported. The package's JSPI entry preserves WebGPU without emitting its
  Asyncify binary, which exceeds Cloudflare's 25 MiB static-asset limit. Vite emits
  the package-resolved regular and JSPI WASM assets; model weights remain separately
  versioned and checksum-verified before entering the browser Cache API.

Use Vitest and Testing Library for deterministic unit/component tests, Playwright for browser-level desktop/mobile journeys, ESLint with typed TypeScript rules, and Wrangler for local Cloudflare emulation, migrations, types, and deployment. Playwright tests deliberately mock provider APIs when no Cloudflare account is available; they complement rather than replace binding-backed preproduction checks. Exact versions are locked in `package-lock.json`.

## Consequences

- The Worker stays orchestration-focused and within a small CPU budget; heavy image and ML work belongs in Web Workers or the browser main-thread fallback.
- D1/R2/Vectorize consistency is explicit and eventual through an outbox.
- Shared schemas add some bundle weight but eliminate divergent API types.
- Client-side rendering avoids SSR complexity; crawler-specific metadata is produced by the narrow Worker shell on event routes.
- The official plugin keeps development close to the Workers runtime and supports Worker-first API/media routing with SPA fallback.

## Alternatives rejected

- Redux: duplicates TanStack Query and Context responsibilities.
- ORM: adds migration/runtime abstraction without enough benefit for the small, explicit D1 schema.
- SSR framework: increases deployment and caching complexity and is outside the v1 contract.
- Separate API/media services: introduces microservice coordination before the product needs it.
- Server-side image processing or ML: exceeds the intended Worker CPU profile and weakens local privacy.
- A custom ONNX runtime wrapper: would duplicate security updates, WASM loading,
  execution-provider fallback, and tensor validation already maintained upstream.
