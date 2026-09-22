# Cadrora agent guide

This file applies to the entire repository. Read it before changing code.

## Required reading order

1. [`docs/technical/README.md`](docs/technical/README.md) for authority, routing, and validation.
2. [`docs/architecture.md`](docs/architecture.md) for trust boundaries and data flow.
3. [`docs/technical/contracts.md`](docs/technical/contracts.md) for frozen API, middleware, storage, and UI contracts.
4. [`docs/implementation-plan.md`](docs/implementation-plan.md) for package ownership and acceptance criteria.
5. The relevant ADR under `docs/decisions/` before adding or replacing a dependency.

## Non-negotiable rules

- TypeScript is strict. Do not introduce `any`; if an external boundary truly requires it, isolate and justify it in a comment.
- Validate every API input and output with a shared Zod schema from `src/shared/schemas/`.
- Keep UI strings in both FR and EN resources. Do not hardcode user-facing copy.
- Preserve the public photographer website at `/` and `/contact`; it must not depend on gallery availability, authentication, a contact-form provider, trackers, or remote assets.
- Reuse semantic tokens and typed components. Do not add page-local palettes or duplicate components.
- Keep secrets in Cloudflare secrets/bindings only. Never log or commit a secret, selfie, raw biometric vector, or credential.
- Authentication and authorization are enforced by the Worker for API and media routes on every hostname, including previews and `workers.dev`.
- D1 is the reference state. Cross-service work is idempotent and repaired through `maintenance_jobs`.
- The browser never uploads a face-search selfie. Facial embeddings are gallery-scoped biometric data with an expiry. Internal `event` identifiers and `/api/v1/events/*` routes are retained for compatibility; user-facing copy says “gallery”.
- Reversible offline state and permanent deletion are separate operations. Deletion fences access in D1 first, then cleans only D1-derived R2 and Vectorize records through retryable maintenance jobs; never delete shared model objects.
- A missing secret, binding, auth proof, or access classification fails closed.
- New dependencies require an ADR in the same change.

## Change discipline

- Keep feature changes inside the package boundaries recorded in the implementation plan unless a cross-cutting integration change is explicitly in scope.
- Preserve unrelated work. Review `git status --short` and `git diff --check` before handoff.
- Update the relevant documentation in the same change, or state precisely why no documentation changed.
- Run at minimum `npm run check` and `npm run test`. Run `npm run build` for runtime, routing, configuration, or dependency changes.
- Report exact commands run and any check that was skipped or could not run.
