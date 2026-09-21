# Cadrora

Cadrora is an open-source, self-hosted photographer website and event photo gallery for one photographer or family. Its static React surface presents the photographer and services, publishes direct contact details, and hosts public or protected event galleries. A Cloudflare Worker backed by D1 and private R2 buckets handles the private application flows. Facial search is optional, event-scoped, disabled by default, and designed so a visitor's selfie stays in their browser.

The core platform, wave-2 product packages, and local wave-3 integration coverage are present. A first deployment still needs its own Cloudflare account, required secrets, and release verification; a passing local build is not proof that a remote account is ready.

## Deploy to your Cloudflare account

For this repository, use the existing GitHub repository as the source of truth: **Cloudflare Dashboard → Workers & Pages → Create application → Continue with GitHub → `lbouriez/Cadrora`**. It does not create another GitHub repository; every reviewed push to `main` is a production build.

Before selecting **Deploy**, complete the short, explicit checklist:

1. Enable R2 in **Storage & databases → R2 Object Storage** if Cloudflare offers **Get started with R2**. The account owner must review and accept that account-level billing/service step. Error `10042` means it is still disabled.
2. Create one D1 database and two private R2 buckets: `cadrora`, `cadrora-media`, and `cadrora-models`. Keep the R2 buckets private.
3. Run `npm ci` and `npm run setup:admin-credentials` locally. Store the generated password in a password manager; Cloudflare receives only `ADMIN_SECRET_HASH`.
4. Create a Managed Turnstile widget for the final hostnames (for example, `cadrora.com` and `www.cadrora.com` only if it will be served). Keep the widget site key and secret key together.
5. In the repository setup screen, keep **Project name** `cadrora`, **Build command** `npm run build`, and set **Deploy command** to `npm run deploy`. Turn **off** builds for non-production branches for the first release.
6. In **Advanced settings**, create/select a dedicated Workers Builds API token, then add the three non-secret build variables: `CADRORA_D1_DATABASE_ID`, `CADRORA_MEDIA_BUCKET_NAME=cadrora-media`, and `CADRORA_MODELS_BUCKET_NAME=cadrora-models`. The D1 ID is displayed on that database's Overview page.
7. Add `ADMIN_SECRET_HASH` and `TURNSTILE_SECRET_KEY` as encrypted build secrets, and `VITE_TURNSTILE_SITE_KEY` plus any desired public `VITE_*` profile values as build variables. `VITE_*` values are public client-build data; do not put a password or secret in them.
8. Select **Deploy**, wait for the production build to succeed, then attach the custom domain. Verify `/`, `/contact`, `/api/v1/site`, and `/admin/login` on the Workers hostname before repeating the checks on the domain.

The release script builds, migrates D1, creates a temporary Worker configuration from those three build variables, uploads only the two supplied secrets, and removes the temporary files. No account ID, database ID, bucket name, API token, or secret is committed. The detailed screen-by-screen checklist and verification steps are in [`docs/deployment.md`](docs/deployment.md#existing-repository-cloudflare-builds).

The [Deploy to Cloudflare button](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Flbouriez%2FCadrora) is retained only for somebody who wants Cloudflare to make an independent cloned repository. It is not the maintainer path for this repository.

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

Cloudflare requires a D1 `database_id` and R2 `bucket_name` for a remote Worker binding. To keep this open-source repository portable, those account-specific values are not committed. `npm run deploy` reads the three `CADRORA_*` build variables, writes an ignored temporary Wrangler file, applies migrations through its `DB` binding, deploys with an ignored two-secret file, then deletes both files. The build therefore remains reproducible without coupling the repository to one Cloudflare account.

Before selecting **Deploy**, generate and retain the admin password locally with `npm run setup:admin-credentials`; provide the resulting PBKDF2 hash—not the password—as `ADMIN_SECRET_HASH`, the widget's public key as `VITE_TURNSTILE_SITE_KEY`, and the matching private key as `TURNSTILE_SECRET_KEY`. The two server secrets are required and the Worker fails closed without them. `DB`, `MEDIA_BUCKET`, and `MODELS_BUCKET` are required bindings; `FACE_INDEX` is intentionally optional, so no Vectorize resource is provisioned by this repository.

Use the named preview environment only for isolated practice, with its own D1/R2 resources and its own required secrets:

```powershell
npm run release:deploy -- --env preview --confirm
```

For a manual production release after authenticating Wrangler, exporting the same three `CADRORA_*` resource values and the two production secrets, use `npm run release:deploy -- --production --confirm`. The normal `npm run deploy` command is the non-interactive Workers Builds entry point: it builds, applies remote D1 migrations through the generated `DB` binding, then deploys. See [`docs/deployment.md`](docs/deployment.md) for the full preflight and verification sequence.

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
| `npm run deploy` | Workers Builds entry point: build, migrate, and deploy production from configured `CADRORA_*` values |
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
