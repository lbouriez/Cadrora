# Deployment guide

This is a deployment preflight for Cadrora. It provides a fresh-account provisioning route but does not make a remote release zero-risk: operators must set secrets, verify generated resources and hostnames, and record the outcome. Cadrora is one Worker named `cadrora`, with Vite static assets, D1, private media R2, and a separate model R2 bucket. The public website at `/` and `/contact` remains a static asset route; do not place it behind the admin guard or make it depend on gallery availability.

## Current deployment status

`wrangler.jsonc` sends `/api/*`, `/media/*`, `/e/*`, `/admin`, `/admin/*`, and `/models/*` through the Worker first. Other paths, including `/` and `/contact`, use the static-assets binding and SPA fallback.

The checked-in configuration intentionally omits D1 IDs and R2 bucket names so Cloudflare’s Deploy Button can provision the configured resources for a fresh account. `wrangler.jsonc` has a production Worker (`cadrora`) and a named preview Worker (`cadrora-preview`). The preview environment explicitly redeclares its non-inherited variables, required secrets, D1 binding, and R2 bindings, so it does not point at production state.

The button invokes `npm run deploy`, which builds the production target, runs `wrangler d1 migrations apply DB --remote`, and invokes Wrangler deploy. Cloudflare's repository setup screen also reads `.env.example`, `.dev.vars.example`, and the binding descriptions in `package.json`; enter the public `VITE_*` profile and Turnstile site key at build time, and keep `ADMIN_SECRET_HASH` plus `TURNSTILE_SECRET_KEY` secret. The manual release commands require an explicit target and `--confirm`; neither the local setup script nor diagnostic mode calls Cloudflare. Do not treat a command exit alone as evidence that custom hostnames, secrets, model objects, or Cron delivery work.

The checked-in configuration has one Cron Trigger, every 15 minutes. Its Worker handler enqueues expired face purges and runs up to 25 maintenance jobs. Confirm the trigger is active on the deployed Worker; source presence is not runtime evidence.

## Local validation

Use only the project commands before a deployment:

```powershell
npm ci
npm run setup:local
npm run setup -- --diagnose
npm run check
npm run test
npm run build
```

For a fresh checkout, `npm run setup:local` generates ignored local admin credentials, configures Cloudflare's official test-only Turnstile pair, and applies the local migrations without printing credential values. It refuses to replace an existing `.env`, `.dev.vars`, or credential artifact. For an existing or manually managed environment, use `npm run setup:admin-credentials`, copy the generated hash into ignored `.dev.vars`, add the matching Turnstile values, and run `npm run setup`. Diagnostic mode validates the required PBKDF2 syntax and source-declared `DB`, `MEDIA_BUCKET`, and `MODELS_BUCKET` bindings without exposing values. It deliberately fails before local D1 work when either required secret is absent.

## Required Worker bindings

Provision and bind the resources named in `wrangler.jsonc` before setting deployment credentials:

| Binding | Current role | Required state |
| --- | --- | --- |
| `ASSETS` | Vite static assets and SPA fallback | Required |
| `DB` | Authoritative D1 data, sessions, events, imports, jobs | Required |
| `MEDIA_BUCKET` | Private image variants | Required |
| `MODELS_BUCKET` | Immutable YuNet and SFace model objects | Required private R2 binding; objects are added only if face search is enabled |
| `FACE_INDEX` | Optional Vectorize facial-search index | Optional in types, absent from current Wrangler configuration |

For a new public fork, use the [Deploy to Cloudflare button](https://developers.cloudflare.com/workers/platform/deploy-buttons/). Its provisioning flow reads these bindings and can create D1/R2 resources from the repository configuration. A manual release script assumes approved remote resources are already bound; do not use it to bootstrap an empty account because it migrates D1 before deployment. Keep preview and production resources separate—never point a preview at production media or D1. Cloudflare binding configuration and non-inherited environment rules are documented in the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) and [environment guide](https://developers.cloudflare.com/workers/wrangler/environments/).

Before the first deployment to a fresh account, enable R2 once in the Cloudflare Dashboard. This is an account-owner service or billing acknowledgement and cannot be completed by the repository; Wrangler reports Cloudflare error `10042` while it remains disabled. D1 and Turnstile must also be accessible in the selected account. If a workstation has used several Cloudflare accounts, verify `wrangler whoami`; use an ignored `.env.local` containing `CLOUDFLARE_ACCOUNT_ID=<target-account-id>` only when Wrangler keeps selecting a stale account. Never commit that local selection.

## Variables and secrets

The Worker configuration declares these non-secret variables:

| Name | Checked-in default | Runtime meaning |
| --- | --- | --- |
| `ADMIN_AUTH_MODE` | `password` | `password` or `cloudflare-access`; there is no open mode |
| `SESSION_TTL_H` | `8` | Password and event-grant lifetime; accepted password-session range is 1–24 hours |
| `MAX_PHOTOS_PER_EVENT` | `2000` | Import declaration cap |
| `MAX_EVENTS` | `50` | Enforced when an administrator creates an event; it is an application guard, not a provider quota |
| `MAX_STORAGE_BYTES` | `10737418240` | Application-level total variant-storage cap |
| `MAX_FACES_PER_EVENT` | `10000` | Facial-index declaration cap |
| `SITE_DEFAULT_LANG` | `fr` | Declared default-language setting |

Set secrets only in Cloudflare secret/binding storage. Never place them in a `VITE_*` value, commit them, or paste them into a deployment log.

| Secret/binding | Needed for |
| --- | --- |
| `ADMIN_SECRET_HASH` | Password admin mode; the accepted format is documented in [`technical/authentication.md`](technical/authentication.md) |
| `TURNSTILE_SECRET_KEY` | Admin login, protected-event unlock, signed event grants, and face-search cursor signing |
| `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` | Cloudflare Access admin mode only |

Public `VITE_*` values are compiled into the client bundle. Set them as Workers Builds variables in the Deploy Button setup screen, or in an ignored local `.env`; `.env.example` is the documented key template and should retain no personal values. Empty contact values render as unavailable; the application does not invent contact information. `VITE_TURNSTILE_SITE_KEY` is public but must belong to the same widget as the private `TURNSTILE_SECRET_KEY`.

## Models and optional face search

Run the repository’s model verification script before any authorized upload:

```powershell
node scripts/models/download.mjs
```

It writes verified artifacts under ignored `.artifacts/models/` and records exact destination keys in `upload-manifest.json`. The deployed Worker serves only the two allowlisted `models/v1/...` keys. Facial search also needs an explicit `FACE_INDEX` Vectorize binding, which is **not present in the current `wrangler.jsonc`**. Without it, galleries continue to work and facial-search requests fail closed.

## Deployment and release checks

After all resources, bindings, secrets, remote migration practice, and model objects are verified, select one explicit target:

```powershell
npm run release:migrate -- --env preview --confirm
npm run release:deploy -- --env preview --confirm
npm run release:deploy -- --production --confirm
```

The deployment command builds first, applies ordered migrations remotely by the `DB` binding, then deploys. For preview, it sets `CLOUDFLARE_ENV=preview` while building; the Cloudflare Vite plugin writes a preview-targeted deployment configuration, so a production build artifact is never reused for preview. Cloudflare’s D1 migration command performs a backup and rolls back the current migration on failure, but it is not an application restore procedure. `npm run deploy` is reserved for the Deploy Button’s production command. Do not run any release command from an unreviewed branch or without a protected change record.

Confirm in the deployed environment that:

- `/` and `/contact` work without an API response, login, tracker, form provider, map, or remote font.
- `/api/*` returns JSON errors rather than SPA HTML.
- `/admin` and `/admin/*` are Worker-guarded on the custom hostname, preview hostname, and `workers.dev` hostname.
- A protected gallery and its `/media/*` URL reject requests without a current grant.
- Public and protected cache headers match [`technical/contracts.md`](technical/contracts.md).
- The two model URLs return the expected immutable objects only when face search is intentionally configured.

There is no automated remote smoke test, deployment approval workflow, or application rollback command in this repository. Record the deployed version and resource identities in the operator’s protected change record before declaring a release complete.
