# ADR-003: Free-tier password verifiers and stable auth pepper

- Status: accepted
- Date: 2026-09-21

## Context

Cadrora targets Cloudflare Workers Free, whose HTTP requests have a 10 ms CPU allowance. The original 600,000-round PBKDF2 verifier took substantially longer and made correct protected-gallery passwords fail in production even though Turnstile, D1, and the stored verifier were valid. Local Node tests did not reproduce the deployed CPU constraint.

Admin verifiers are Worker secrets, while event verifiers are stored in D1. A replacement must stay within the free-tier budget, keep the clear passwords out of storage, prevent admin and event verifiers from being interchangeable, and remain stable when the admin password changes.

## Decision

Generate a random server-only `AUTH_PEPPER` containing at least 32 random bytes. Store admin and event credentials as `hmac-sha256$base64url-salt$base64url-mac`, using a fresh 32-byte salt and separate `admin` and `event` HMAC domains. Use the same stable pepper with different domains to sign demo sessions and event grants. Keep Turnstile and rate limiting in front of password exchanges, and fail closed when the pepper or verifier is absent or malformed.

The generated showcase password is public by design. Permit it only for the reserved `demo-private` event while `DEMO_SHOWCASE_ENABLED=true`; real protected events always require their stored event-domain verifier.

Existing private artifacts migrate with `npm run setup:admin-credentials -- --migrate`. Migration preserves `ADMIN_PASSWORD`, creates or reuses `AUTH_PEPPER`, and recalculates `ADMIN_SECRET_HASH` without printing any value. Operators must replace both encrypted secrets before deploying the new runtime.

## Consequences

- Password verification fits the no-cost Worker target; production proof must still include a live unlock because local execution does not enforce the same CPU ceiling.
- A D1-only leak does not reveal the pepper needed to test event-password guesses offline.
- HMAC is intentionally fast, so strong passwords, pepper confidentiality, Turnstile, rate limits, TLS, and scoped grants remain mandatory controls.
- Rotating the admin password does not revoke event grants or invalidate event verifiers. Rotating `AUTH_PEPPER` intentionally invalidates all HMAC verifiers and signed capabilities, so it requires coordinated credential rotation.
- Deploy Button users configure three encrypted values: `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY`.

## Alternatives rejected

- Retain PBKDF2 600k: incompatible with the free-tier request CPU allowance.
- Lower PBKDF2 until it sometimes fits: leaves too little budget for routing, validation, and D1 and remains runtime-dependent.
- Reuse `ADMIN_SECRET_HASH` as the event key: changing the admin password would silently invalidate every protected gallery.
- Store an unkeyed fast digest in D1: a database copy would enable inexpensive offline guessing of typical gallery passwords.
- Require a paid Worker or external identity provider for every gallery: conflicts with the documented no-cost, portable deployment goal.
