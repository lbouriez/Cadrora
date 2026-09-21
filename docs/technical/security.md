# Security and privacy boundaries

This guide summarizes engineering constraints; executable auth and authorization tests remain the final implementation evidence.

## Trust boundaries

- Browser input, page context, filenames, EXIF, cursors, and public query results are untrusted.
- Only the Worker accesses D1, R2, Vectorize, and secret bindings.
- Public SPA routing never implies API or media authorization.
- Protected media is streamed only after event-grant validation; object keys are derived from validated D1 records, never from a client-supplied storage key.

## Fail-closed behavior

- No admin route exists without password or verified Cloudflare Access mode.
- The public demo account has a separate, signed `read-only` capability. A fail-closed exact route allowlist rejects all demo mutations and unknown future admin reads before provider access.
- Missing secrets lock admin behavior and return a calm actionable error; they never open access.
- Missing auth produces an empty auth context, followed by a route-level 401/403.
- Unknown content classification is private and not cached.
- Vectorize absence disables facial features without blocking core galleries.

## Sensitive data

Never commit, log, or expose passwords, secret hashes, session tokens, event credentials, raw vectors, selfies, face coordinates, private EXIF, or production binding identifiers. Request logs use request IDs and stable error codes, not sensitive payloads.

Facial embeddings are biometric data even though they are not images. Keep them event-scoped, versioned by model/generation, inaccessible to public APIs, and covered by an expiry and verifiable purge job.

## Release checks

- Exercise protected API and media URLs directly, including `workers.dev` and preview hosts.
- Verify invalid/expired Access JWTs and changed event `accessVersion` fail.
- Confirm admin and protected responses do not enter shared cache.
- Confirm API 404 and errors are JSON without stack traces.
- Confirm source-derived images contain none of the stripped EXIF fields.
- Sign in with the published demo identity and verify create, update, publish, import, upload, delete, and unknown admin routes all return `DEMO_READ_ONLY` without changing D1 or R2.
