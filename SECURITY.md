# Security policy

## Supported state

Cadrora has no tagged stable release or published support window in this repository. Security fixes should target the current default development line until maintainers publish a version policy.

## Reporting a vulnerability

Report vulnerabilities through [GitHub's private vulnerability reporting channel](https://github.com/lbouriez/Cadrora/security/advisories/new). Private reporting is enabled for this repository. Do **not** open a public issue containing an exploit, production URL, credential, cookie, private photo, selfie, embedding, vector ID, or personal data.

Include only the minimum necessary reproduction details, the affected version or commit, the expected access boundary, and the observed result. Do not attach real customer photos or credentials. Maintainers should acknowledge receipt, assess affected deployments, and coordinate remediation before public disclosure. A fork must publish its own verified reporting channel; do not send another operator's private data to this repository.

## In scope

Examples include:

- bypass of admin, event-grant, media, Cloudflare Access, Turnstile, or Origin-CSRF protection;
- access to a private gallery, photo, model bucket, D1 record, session, password hash, embedding, or face metadata;
- cache behavior that exposes protected content;
- unsafe import parsing, object-key control, upload validation, or deletion behavior;
- disclosure of secrets or data through errors, logs, source maps, or build configuration.

## Handling rules

- Treat raw biometric vectors, source images, event passwords, and session cookies as sensitive data.
- Share request IDs, redacted headers, and minimal proof before sharing any private resource.
- Do not ask reporters to upload selfies or private media.
- Verify the custom hostname, preview hostname, and `workers.dev` hostname independently.
- Do not claim provider cleanup or deletion completed until the relevant maintenance work has verifiable completion evidence.

See [`docs/privacy.md`](docs/privacy.md) and [`docs/operations.md`](docs/operations.md) for current data handling and incident constraints.
