# Authentication and admin-shell integration

PA provides the authentication primitives and admin UI. The root Worker mounts `adminAuthRouter` under `/api/v1/admin` after the frozen global middleware chain and installs `app.use('/api/v1/admin/*', adminCsrf)` before every admin route registration. Future handlers must also apply `requireAdmin`. This makes direct requests to custom domains, previews, and `workers.dev` use the same Worker-side check.

The integration owner also installs `adminPageGuard` after `authContext` and configures `/admin/*` as Worker-first. It allows the password login page only in password mode; all remaining password admin navigations redirect to that page without a session. In Cloudflare Access mode every `/admin/*` navigation, including `/admin/login`, requires a verified JWT. Admin pages are marked `Cache-Control: no-store`.

## Password mode

Set `ADMIN_AUTH_MODE=password` and provide both `ADMIN_SECRET_HASH` and `AUTH_PEPPER` as Cloudflare secrets. Generate the matching pair on a trusted workstation with `npm run setup:admin-credentials`; do not hand-build or independently rotate either value. The generated pepper contains at least 32 random bytes. Never place the password, verifier, or pepper in source, browser variables, request logs, screenshots, or issue comments.

The deployed verifier format is `hmac-sha256$base64url-salt$base64url-mac`, with a random 32-byte salt and an HMAC-SHA-256 MAC. The admin domain and protected-event domain are different, so the same clear text does not produce an interchangeable credential. `ADMIN_SECRET_HASH` contains only the admin-domain verifier; the pepper remains a separate Worker secret. Protected-event rows in D1 store only event-domain HMAC verifiers in the same format. Clear passwords are accepted transiently by their endpoints and are never persisted.

This design is an explicit Workers Free runtime trade-off. A 600,000-iteration PBKDF2 verification consumes substantially more than the plan's 10 ms CPU allowance, so a correct password could fail when the Worker exhausts its CPU budget. HMAC-SHA-256 is compatible with that request budget. Its speed means the protection now depends on a strong generated admin password, protected event passwords, Turnstile/rate limiting, and confidentiality of `AUTH_PEPPER`; it is not a substitute for those controls. Rotate the pepper and every stored verifier together if the pepper may have been exposed.

The Worker stores only SHA-256 hashes of opaque 256-bit session tokens in D1. Password-session reads rotate the token, and logout revokes the D1 row and clears the `__Host-cadrora-admin` cookie. Cookie attributes are `Path=/; HttpOnly; Secure; SameSite=Strict`; there is deliberately no `Domain` attribute. `SESSION_TTL_H` defaults to eight hours and accepts only 1 through 24.

### Published read-only demo

The official showcase may publish the non-secret username and password configured as `DEMO_ADMIN_USERNAME` and `DEMO_ADMIN_PASSWORD` only when the release opt-in materializes `DEMO_SHOWCASE_ENABLED=true`. The checked-in default is false, and `CADRORA_SEED_DEMO=true` is the only documented way to enable it. These values identify a demonstration role; they do not grant owner access. After normal Turnstile and rate-limit checks, the Worker issues a distinct one-hour `__Host-cadrora-demo` cookie. Its stateless payload is signed with its own domain-separated HMAC using `AUTH_PEPPER`; no raw secret or owner token reaches the browser and no demo session row is written to D1.

The seeded `demo-private` event also has a narrowly scoped showcase-only password bypass so the disposable published demo credential remains usable without spending the Workers Free CPU budget. It is active only when the explicit showcase gate is true and only for that reserved event. Normal protected events always use their stored event-domain verifier. Never enable the showcase gate for a real photographer deployment or copy this bypass to another event.

`Session.access` is the authorization capability. `manage` is reserved for real password or Cloudflare Access sessions. `read-only` is accepted only by an exact server-side allowlist: session, event list, publication readiness, usage, login, and logout. All other admin requests—including future GET routes—return `DEMO_READ_ONLY` before a handler can access D1, R2, Vectorize, or Cloudflare administration. Hiding buttons in React is only presentation and is never the security boundary.

Owner and demo login failures use separate per-IP limiter buckets. A successful login clears only its own bucket, so the published demo password cannot reset owner-password protection.

## Cloudflare Access mode

Set `ADMIN_AUTH_MODE=cloudflare-access`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD` as bindings. The Worker accepts the `Cf-Access-Jwt-Assertion` header only, fetches the configured team's JWKS, imports the matching RSA signing key with WebCrypto, and verifies RS256 signature, exact issuer, configured audience, and expiry for every request. A Cloudflare edge policy is useful defense in depth but is not considered authorization by the Worker.

## Login protections and UI hook

Turnstile is verified server-side only for `/api/v1/admin/login` and event unlock. Failed password logins are tracked per `CF-Connecting-IP` and block the sixth attempt for 15 minutes. All state-changing admin requests, including login, require an `Origin` matching the request origin.

`src/app/admin/AdminRoutes.tsx` merges `adminResourceFragment` and import resources into FR and EN i18next bundles, mounts admin CSS, and provides `AdminLoginPage` with a rendered `TurnstileChallenge`. The Turnstile secret remains server-only.
