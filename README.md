# Cadrora

Cadrora is an open-source, self-hosted photographer website and event photo gallery for one photographer or family. Its static React surface presents the photographer and services, publishes direct contact details, and hosts public or protected event galleries. A Cloudflare Worker backed by D1 and private R2 buckets handles the private application flows. Facial search is optional, event-scoped, disabled by default, and designed so a visitor's selfie stays in their browser.

The core platform, wave-2 product packages, and local wave-3 integration coverage are present. A first deployment still needs its own Cloudflare account, required secrets, and release verification; a passing local build is not proof that a remote account is ready.

## Deploy to your Cloudflare account

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Flbouriez%2FCadrora)

The normal installation path is the button above:

1. Once per installation, enable R2 in the target Cloudflare account if it has never been used there, then run `npm ci` and `npm run setup:admin-credentials`. Keep the generated password in a password manager and keep the generated `ADMIN_SECRET_HASH` ready for Cloudflare. Create a Turnstile widget for the intended hostname and keep its public site key and secret key ready.
2. Select **Deploy to Cloudflare**, sign in, and accept or rename the proposed Worker, D1, and R2 resources. Enter the public `VITE_*` photographer/contact values, `VITE_TURNSTILE_SITE_KEY`, `ADMIN_SECRET_HASH`, and `TURNSTILE_SECRET_KEY` when prompted.
3. Select **Deploy**. Cloudflare clones the repository, provisions and binds the D1 database and two private R2 buckets, applies the ordered D1 migrations by the `DB` binding, builds the static website and Worker, and publishes them to the new account.

No account ID, database ID, bucket name, or API token needs to be committed. Facial search remains optional and is not provisioned by the quick path. After deployment, open `/`, `/contact`, and `/admin/login`, then complete the remote verification checklist in [`docs/deployment.md`](docs/deployment.md) before attaching a production domain.

R2 activation is an account-level prerequisite that Cloudflare may present as a billing or service-enablement step; the Deploy Button cannot accept it on the account owner's behalf. If it is missing, Wrangler exits with Cloudflare error `10042` before listing or provisioning buckets.

Cloudflare's button is the recommended few-click path. The reproducible Wrangler fallback is `npm run release:deploy -- --production --confirm` after `wrangler login`, resource/secret configuration, and the same preflight; it deliberately refuses an implicit target. See [Cloudflare's Deploy Button documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/) for the provider-owned flow.

## Quick start

Prerequisites: Node.js 22.12 or newer and npm 10 or newer.

```powershell
npm ci
npm run setup:local
npm run dev
```

`setup:local` creates the ignored `.dev.vars` and `.env` files, generates a private admin password and PBKDF2 hash, installs Cloudflare's official always-pass Turnstile test-key pair, and applies the local D1 migrations. It refuses to overwrite any existing local setup file and never prints credential values. Open `.artifacts/setup/admin-credentials.env` only in a trusted local editor to retrieve the local admin password.

The Turnstile keys created by `setup:local` are intentionally limited to development and work on localhost; never deploy them. See [Cloudflare's Turnstile testing documentation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). For a manual setup or an existing environment, copy `.dev.vars.example` to `.dev.vars` and `.env.example` to `.env`, generate credentials with `npm run setup:admin-credentials`, add the matching values, then run `npm run setup`.

`npm run setup` applies only local, idempotent D1 migrations through the `DB` binding and preserves existing data. It does not create remote resources or replace any secret.

To inspect prerequisites without changing local state:

```powershell
npm run setup -- --diagnose
```

Diagnostic mode intentionally exits non-zero when required local secrets are absent or malformed, before it writes local D1 state. It reports only presence and accepted format, never secret values. Never prefix a secret with `VITE_`.

Before a public launch, set the non-secret `VITE_PHOTOGRAPHER_NAME`, `VITE_CONTACT_PHONE`, `VITE_CONTACT_EMAIL`, `VITE_CONTACT_ADDRESS`, and `VITE_SERVICE_AREA` build variables described in [`docs/technical/public-website.md`](docs/technical/public-website.md). Empty values are omitted rather than replaced with fake contact details.

## Deployment details

For a public fork, the button reads `wrangler.jsonc`, provisions the configured D1 and two private R2 bindings when they have no existing resource IDs/names, prompts for required build variables and secrets, runs `npm run deploy`, and creates the production Worker. The repository deliberately does not include an account ID, database ID, bucket name, API token, or secret. Record the generated resource names in the account’s protected operator record.

Before selecting **Deploy**, generate and retain the admin password locally with `npm run setup:admin-credentials`; provide the resulting PBKDF2 hash—not the password—as `ADMIN_SECRET_HASH`, the widget's public key as `VITE_TURNSTILE_SITE_KEY`, and the matching private key as `TURNSTILE_SECRET_KEY`. The two server secrets are required and the Worker fails closed without them. `DB`, `MEDIA_BUCKET`, and `MODELS_BUCKET` are required bindings; `FACE_INDEX` is intentionally optional, so no Vectorize resource is provisioned by this repository.

Use the named preview environment only for isolated practice, with its own D1/R2 resources and its own required secrets:

```powershell
npm run release:deploy -- --env preview --confirm
```

For a manual production release after authenticating Wrangler and setting the production secrets, use `npm run release:deploy -- --production --confirm`. The normal `npm run deploy` command is the non-interactive Deploy Button entry point: it builds, applies remote D1 migrations through the `DB` binding, then deploys. See [`docs/deployment.md`](docs/deployment.md) for the full preflight and verification sequence.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce the locked dependency tree |
| `npm run setup` | Validate required local secrets and apply idempotent local D1 migrations |
| `npm run setup -- --diagnose` | Read-only local prerequisite and binding diagnostic |
| `npm run setup:local` | One-command first local setup with generated credentials, official Turnstile test keys, and D1 migrations |
| `npm run setup:admin-credentials` | Write a long password and PBKDF2 hash to ignored local artifacts without printing values |
| `npm run dev` | Run the React SPA and Worker in the Workers runtime |
| `npm run check` | Type-check and lint |
| `npm run test` | Run the unit suite once |
| `npm run build` | Build Worker and client artifacts |
| `npm run release:migrate -- --production --confirm` | Apply remote D1 migrations via the `DB` binding only |
| `npm run release:deploy -- --production --confirm` | Build, migrate, and deploy the explicit production target |
| `npm run deploy` | Deploy Button entry point: build, migrate, and deploy production |
| `npm run deploy:preview` | Build, migrate, and deploy the isolated preview environment |

## Project map

```text
src/app/       React application, shared components, i18n, and tokens
src/browser/   Browser-only image, face, and import processing
src/server/    Hono Worker, routes, auth, services, and maintenance
src/shared/    Zod schemas, shared types, errors, and constants
migrations/    Ordered D1 migrations
scripts/       Setup, models, and release automation
tests/         Unit, integration, end-to-end tests, and fixtures
docs/          Architecture, contracts, ADRs, and operator documentation
public/brand/  Versioned brand assets
```

Start with [`AGENTS.md`](AGENTS.md) when contributing through a coding agent. Human contributors should also read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/technical/README.md`](docs/technical/README.md).
