# Authentication and admin-shell integration

PA provides the authentication primitives and admin UI. The root Worker mounts `adminAuthRouter` under `/api/v1/admin` after the frozen global middleware chain and installs `app.use('/api/v1/admin/*', adminCsrf)` before every admin route registration. Future handlers must also apply `requireAdmin`. This makes direct requests to custom domains, previews, and `workers.dev` use the same Worker-side check.

The integration owner also installs `adminPageGuard` after `authContext` and configures `/admin/*` as Worker-first. It allows the password login page only in password mode; all remaining password admin navigations redirect to that page without a session. In Cloudflare Access mode every `/admin/*` navigation, including `/admin/login`, requires a verified JWT. Admin pages are marked `Cache-Control: no-store`.

## Password mode

Set `ADMIN_AUTH_MODE=password` and provide `ADMIN_SECRET_HASH` only as a Cloudflare secret. Its accepted format is `pbkdf2-sha256$600000$base64url-salt$base64url-derived-key`; it uses a random 16-byte salt, PBKDF2-SHA-256, and a 32-byte derived key. Generate the value in a trusted local setup path with `createPasswordHash`; never place the password or resulting hash in source, browser variables, request logs, or issue comments.

The Worker stores only SHA-256 hashes of opaque 256-bit session tokens in D1. Password-session reads rotate the token, and logout revokes the D1 row and clears the `__Host-cadrora-admin` cookie. Cookie attributes are `Path=/; HttpOnly; Secure; SameSite=Strict`; there is deliberately no `Domain` attribute. `SESSION_TTL_H` defaults to eight hours and accepts only 1 through 24.

## Cloudflare Access mode

Set `ADMIN_AUTH_MODE=cloudflare-access`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD` as bindings. The Worker accepts the `Cf-Access-Jwt-Assertion` header only, fetches the configured team's JWKS, imports the matching RSA signing key with WebCrypto, and verifies RS256 signature, exact issuer, configured audience, and expiry for every request. A Cloudflare edge policy is useful defense in depth but is not considered authorization by the Worker.

## Login protections and UI hook

Turnstile is verified server-side only for `/api/v1/admin/login` and event unlock. Failed password logins are tracked per `CF-Connecting-IP` and block the sixth attempt for 15 minutes. All state-changing admin requests, including login, require an `Origin` matching the request origin.

`src/app/admin/AdminRoutes.tsx` merges `adminResourceFragment` and import resources into FR and EN i18next bundles, mounts admin CSS, and provides `AdminLoginPage` with a rendered `TurnstileChallenge`. The Turnstile secret remains server-only.
