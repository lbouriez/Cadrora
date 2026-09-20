# Contributing to Cadrora

Thank you for improving Cadrora. It is a static photographer website plus a Cloudflare Worker-backed event gallery. Preserve `/` and `/contact` as public, static, tracker-free routes; never make them depend on login, gallery availability, remote fonts, maps, or a contact-form provider.

## Local setup

Requirements are Node.js 22.12+ and npm 10+.

```powershell
npm ci
npm run setup -- --diagnose
npm run check
npm run test
npm run build
```

`npm run setup` without diagnostic mode applies the local D1 migration. It does not modify a remote Cloudflare account. Copy `.dev.vars.example` only for local secrets; never commit `.dev.vars`, `.env`, artifacts, cookies, real media, or credentials.

## Contribution rules

- Read [`AGENTS.md`](AGENTS.md), the technical documentation index, contracts, architecture, and relevant package guide before editing.
- Keep TypeScript strict and avoid `any`. Validate API input and output with shared Zod schemas.
- Keep user-facing UI copy in FR and EN, using shared components and semantic tokens.
- Do not add a dependency without a same-change ADR under `docs/decisions/`.
- Preserve D1 as reference state. Cross-service changes must be idempotent and repairable through `maintenance_jobs`.
- Never log, commit, or include in tests a secret, credential, raw selfie, raw biometric vector, private EXIF, or private production asset.
- Keep facial-search privacy boundaries: a visitor selfie stays local; search cannot grant event access; no identity claims or cross-event profiles.

## Testing expectations

Run `npm run check` and `npm run test` for every change. Also run `npm run build` for runtime, route, dependency, configuration, browser-pipeline, or deployment changes. Add focused behavior tests beside the owned package. Review `git diff --check` and `git status --short` before requesting review.

For public-site UI changes, inspect `/` and `/contact` at 390 px and desktop width in FR and EN, with both configured and empty contact values. For import and face-search changes, follow the release checks in their technical guides; source-level tests do not prove real-device model behavior.

## Reviewable changes

Keep each change focused, document user-visible or operational behavior in the same change, and state validation actually run. Do not bundle unrelated worktree changes. If behavior is intentionally incomplete or unintegrated, say so plainly rather than documenting an assumed future integration.

Security-sensitive issues must follow [`SECURITY.md`](SECURITY.md), not public disclosure with sensitive reproduction data.
