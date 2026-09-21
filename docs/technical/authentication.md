# Authentication and admin-shell integration

PA provides the authentication primitives and admin UI. The root Worker mounts `adminAuthRouter` under `/api/v1/admin` after the frozen global middleware chain and installs `app.use('/api/v1/admin/*', adminCsrf)` before every admin route registration. Future handlers must also apply `requireAdmin`. This makes direct requests to custom domains, previews, and `workers.dev` use the same Worker-side check.

The integration owner also installs `adminPageGuard` after `authContext` and configures `/admin/*` as Worker-first. It allows the password login page only in password mode; all remaining password admin navigations redirect to that page without a session. In Cloudflare Access mode every `/admin/*` navigation, including `/admin/login`, requires a verified JWT. Admin pages are marked `Cache-Control: no-store`.

## Password mode

Set `ADMIN_AUTH_MODE=password` and provide `ADMIN_SECRET_HASH` only as a Cloudflare secret. Its accepted format is `pbkdf2-sha256$600000$base64url-salt$base64url-derived-key`; it uses a random 16-byte salt, PBKDF2-SHA-256, and a 32-byte derived key. Generate the value in a trusted local setup path with `createPasswordHash`; never place the password or resulting hash in source, browser variables, request logs, or issue comments.

Protected-gallery passwords use the same audited hash parser and verifier. D1 stores only this salted 600,000-iteration PBKDF2 hash; the clear password is accepted transiently by the unlock endpoint and is never persisted.

The Worker derives PBKDF2 keys with Cloudflare's native `node:crypto` implementation. The repository targets a compatibility date where Node.js compatibility is enabled by default; setup tooling uses the same algorithm and byte lengths, so generated and runtime hashes are interoperable.

The Worker stores only SHA-256 hashes of opaque 256-bit session tokens in D1. Password-session reads rotate the token, and logout revokes the D1 row and clears the `__Host-cadrora-admin` cookie. Cookie attributes are `Path=/; HttpOnly; Secure; SameSite=Strict`; there is deliberately no `Domain` attribute. `SESSION_TTL_H` defaults to eight hours and accepts only 1 through 24.

### Published read-only demo

The official showcase may publish the non-secret username and password configured as `DEMO_ADMIN_USERNAME` and `DEMO_ADMIN_PASSWORD` only when the release opt-in materializes `DEMO_SHOWCASE_ENABLED=true`. The checked-in default is false, and `CADRORA_SEED_DEMO=true` is the only documented way to enable it. These values identify a demonstration role; they do not grant owner access. After normal Turnstile and rate-limit checks, the Worker issues a distinct one-hour `__Host-cadrora-demo` cookie. Its stateless payload is signed with a domain-separated HMAC derived from `ADMIN_SECRET_HASH`; no raw secret or owner token reaches the browser and no demo session row is written to D1.

`Session.access` is the authorization capability. `manage` is reserved for real password or Cloudflare Access sessions. `read-only` is accepted only by an exact server-side allowlist: session, event list, publication readiness, usage, login, and logout. All other admin requests—including future GET routes—return `DEMO_READ_ONLY` before a handler can access D1, R2, Vectorize, or Cloudflare administration. Hiding buttons in React is only presentation and is never the security boundary.

Owner and demo login failures use separate per-IP limiter buckets. A successful login clears only its own bucket, so the published demo password cannot reset owner-password protection.

## Cloudflare Access mode

Set `ADMIN_AUTH_MODE=cloudflare-access`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD` as bindings. The Worker accepts the `Cf-Access-Jwt-Assertion` header only, fetches the configured team's JWKS, imports the matching RSA signing key with WebCrypto, and verifies RS256 signature, exact issuer, configured audience, and expiry for every request. A Cloudflare edge policy is useful defense in depth but is not considered authorization by the Worker.

## Login protections and UI hook

Turnstile is verified server-side only for `/api/v1/admin/login` and event unlock. Failed password logins are tracked per `CF-Connecting-IP` and block the sixth attempt for 15 minutes. All state-changing admin requests, including login, require an `Origin` matching the request origin.

`src/app/admin/AdminRoutes.tsx` merges `adminResourceFragment` and import resources into FR and EN i18next bundles, mounts admin CSS, and provides `AdminLoginPage` with a rendered `TurnstileChallenge`. The Turnstile secret remains server-only.
