# Cadrora

Cadrora is an open-source, self-hosted photographer website and photo-gallery product for one photographer or family. Its static React surface presents the photographer and services, publishes direct contact details, and hosts public or protected galleries. A Cloudflare Worker backed by D1 and private R2 buckets handles the private application flows. Facial search is optional and strictly gallery-scoped: it is enabled for the official fictitious showcase only, and a visitor's selfie stays in their browser. Possible matches and their nearby moments can be reviewed through a temporary **All photos / Found for me** gallery view; no selfie, embedding, or similarity score is stored with that view.

The core platform, wave-2 product packages, and local wave-3 integration coverage are present. A first deployment still needs its own Cloudflare account, required secrets, and release verification; a passing local build is not proof that a remote account is ready.

### D1 and R2, in plain language

You do not need to already know Cloudflare's product names. Cadrora uses two complementary storage services:

Cloudflare uses product names that are easy to confuse on a first deployment:

- **D1 is the database.** Cadrora stores the small structured records there: galleries, visibility, photo metadata, password hashes, sessions, import progress, and cleanup jobs. The first database schema used the internal table name `events`; this is a storage implementation detail and every HTTP route uses `/galleries`. The D1 database named `cadrora` is comparable to the application's catalog and control panel; it does **not** contain the image files themselves.
- **R2 is private file storage.** It is comparable to a cloud hard drive. `cadrora-media` contains the actual gallery image variants. `cadrora-models` is a separate bucket reserved for the optional face-search model files. Both buckets must remain private: visitors receive media through the Worker only after Cadrora has checked access.
- **Vectorize is the search index.** It stores compact numeric face vectors, never selfie files or image files. `cadrora-face-index` is the production index used only after a gallery owner enables face search. The official demo derives vectors from its generated fictional gallery photos during deployment so the downloadable Amelia and Daniel portraits return real possible matches; visitor portraits are never added to the index.
- **A binding connects the Worker to one resource.** In the setup screen, `DB` must point to the D1 database, `MEDIA_BUCKET` to the media R2 bucket, `MODELS_BUCKET` to the models R2 bucket, and `FACE_INDEX` to the Vectorize index. Production and preview must use separate resources.

The names are yours to choose, but the setup variables must contain their exact UUID/name. Creating the resources does not make them public and does not upload any gallery automatically.

## Deploy to your Cloudflare account

For this repository, use the existing GitHub repository as the source of truth: **Cloudflare Dashboard → Workers & Pages → Create application → Continue with GitHub → `lbouriez/Cadrora`**. It does not create another GitHub repository; every reviewed push to `main` is a production build.

Before selecting **Deploy**, complete the short, explicit checklist:

1. Enable R2 in **Storage & databases → R2 Object Storage** if Cloudflare offers **Get started with R2**. The account owner must review and accept that account-level billing/service step. Error `10042` means it is still disabled.
2. Create one D1 database and two private R2 buckets: `cadrora`, `cadrora-media`, and `cadrora-models`. Keep the R2 buckets private. Create the `cadrora-face-index` Vectorize index at 128 dimensions with the cosine metric, then add a string metadata index named `partition_id`.
3. Run `npm ci` and `npm run setup:admin-credentials` locally. Store the generated password in a password manager. The ignored artifact contains both `ADMIN_SECRET_HASH` and a random `AUTH_PEPPER` of at least 32 bytes; Cloudflare needs both values, but never the clear password.
4. Create a Managed Turnstile widget for the final hostnames (for example, `cadrora.com` and `www.cadrora.com` only if it will be served). Keep the widget site key and secret key together.
5. In the repository setup screen, keep **Project name** `cadrora`, **Build command** `npm run build`, and set **Deploy command** to `npm run deploy`. Turn **off** builds for non-production branches for the first release.
6. In **Advanced settings**, create/select a dedicated Workers Builds API token, then add the three non-secret build variables: `CADRORA_D1_DATABASE_ID`, `CADRORA_MEDIA_BUCKET_NAME=cadrora-media`, and `CADRORA_MODELS_BUCKET_NAME=cadrora-models`. The D1 ID is displayed on that database's Overview page.
7. Add `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY` as three encrypted build secrets: paste each value, then select **Encrypt**. The first two are the matching lines in the ignored `.artifacts/setup/admin-credentials.env` file; never paste `ADMIN_PASSWORD`. To recover the Turnstile values later, open **Application security → Turnstile → Cadrora Production**: its **Secret key** goes into `TURNSTILE_SECRET_KEY`, while its **Site key** goes into the normal (not encrypted) `VITE_TURNSTILE_SITE_KEY` variable. `VITE_*` values are public client-build data; do not put a password, pepper, or secret in them.
8. For the official Cadrora showcase only, add the normal build variable `CADRORA_SEED_DEMO=true`; this single opt-in enables the read-only demo identity and links, uploads the tracked generated sample media and checksum-pinned AI models to private R2, repairs three reserved sample events in D1, derives SFace embeddings from the fictional gallery photos, verifies that both downloadable test portraits have matches, and upserts those generated vectors into Vectorize. It defaults to off: leave it unset for a real photographer site. `VITE_GA_MEASUREMENT_ID` is also optional: Google Analytics remains disabled unless it contains a valid GA4 ID and the visitor consents.
9. Select **Deploy**, wait for the production build to succeed, then attach the custom domain. Verify `/`, `/services`, `/galleries`, `/contact`, `/privacy`, `/api/v1/site`, and `/admin/login` on the Workers hostname before repeating the checks on the domain. Gallery HTTP routes consistently use `/galleries`; `/events` is intentionally not retained as an alias.

The release script builds, migrates D1, creates a temporary Worker configuration from those three build variables, uploads only the two supplied secrets, and removes the temporary files. No account ID, database ID, bucket name, API token, or secret is committed. The detailed screen-by-screen checklist and verification steps are in [`docs/deployment.md`](docs/deployment.md#existing-repository-cloudflare-builds).

The [Deploy to Cloudflare button](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Flbouriez%2FCadrora) is retained only for somebody who wants Cloudflare to make an independent cloned repository. It is not the maintainer path for this repository.

### First use after deployment

1. Open `/admin/login` on the deployed hostname and sign in with the clear admin password you stored locally. Cloudflare never receives that clear value as a build secret.
2. Open **Site settings**. Select one or both available languages, choose a default from that selection, and set the visitor colour policy. One language hides the public language control; two let visitors choose.
3. On that screen, optionally choose lower guardrails for gallery count, stored media, and indexed faces. Gallery count means separate galleries—not photos; the checked-in limits allow 50 galleries with up to 2,000 photos in each. Cadrora enforces these limits on new writes; they are per-instance safeguards rather than account-wide billing guarantees.
4. Create a **gallery**, configure public or password-protected access, retention, downloads, metadata, and optional gallery-scoped face/nearby search, then import photos.
5. Publish publicly or as unlisted. **Offline** is reversible and retains D1, R2, and Vectorize data. **Delete gallery** is permanent, requires typing the exact title, blocks access immediately, and lets the scheduled Worker clean gallery-owned provider data asynchronously. Shared AI model files are not deleted.
6. Verify the gallery from a signed-out browser. For protected access and face search, verify Turnstile on the exact custom hostname before sharing it.

### Deployment ceilings and owner self-limits

The repository ships with reviewed deployment ceilings in `wrangler.jsonc`. They apply before an owner chooses any lower values in **Admin → Site settings**:

| Setting | Checked-in ceiling | Meaning |
| --- | ---: | --- |
| `MAX_PHOTOS_PER_EVENT` | `2000` | Maximum photos in one gallery |
| `MAX_EVENTS` | `50` | Maximum separate galleries; this is not a 50-photo limit |
| `MAX_STORAGE_BYTES` | `9900000000` | Total media variants stored by this instance, in decimal bytes |
| `MAX_FACES_PER_EVENT` | `10000` | Maximum indexed faces in one gallery |
| `MAX_TOTAL_FACES` | `39000` | Maximum indexed faces across the instance |

The deployment owner may change these values in both the top-level production `vars` and the explicitly redeclared `env.preview.vars`, then redeploy. The web administrator can only select lower gallery, storage, and total-face limits; this prevents the admin UI from silently overriding an infrastructure decision. Cadrora additionally caps media and stored face dimensions against the relevant Cloudflare Free allowances, but account-level traffic and operation usage must still be monitored in Cloudflare.

### Which account can use a hostname?

- If the selected Cloudflare account owns the active `cadrora.com` zone, it can deploy an isolated Worker at `toto.cadrora.com` with `npm run deploy:instance -- --instance toto --hostname toto.cadrora.com --confirm`.
- A third party who forks Cadrora into a different Cloudflare account cannot attach `toto.cadrora.com`, because that account does not own the `cadrora.com` zone. They should normally use a domain or subdomain in a zone they own, such as `photos.their-domain.com`.
- Serving `toto.cadrora.com` from another account would require deliberately delegating and operating that child DNS zone. That is an advanced infrastructure choice and is not part of Cadrora's simple deployment flow.

Cloudflare Custom Domains require an active zone in the selected account and cannot be created on a zone that account does not own. `deploy:instance` is an authenticated local Wrangler deployment; it does not create a new Cloudflare-to-Git connection. Update the fork, then rerun the same command to publish a later version. The complete root-domain and subdomain examples are in [`docs/deployment.md`](docs/deployment.md#additional-isolated-domain-or-subdomain).

## Quick start

Prerequisites: Node.js 22.12 or newer and npm 10 or newer.

```powershell
npm ci
npm run setup:local
npm run dev
```

`setup:local` creates the ignored `.dev.vars` and `.env` files, generates a private admin password, its HMAC-SHA-256 verifier, and a random `AUTH_PEPPER` of at least 32 bytes, installs Cloudflare's official always-pass Turnstile test-key pair, and applies the local D1 migrations. It refuses to overwrite any existing local setup file and never prints credential values. Open `.artifacts/setup/admin-credentials.env` only in a trusted local editor to retrieve the local admin password and the two matching deployment secrets.

The Turnstile keys created by `setup:local` are intentionally limited to development and work on localhost; never deploy them. See [Cloudflare's Turnstile testing documentation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). For a manual setup or an existing environment, copy `.dev.vars.example` to `.dev.vars` and `.env.example` to `.env`, generate credentials with `npm run setup:admin-credentials`, add the matching values, then run `npm run setup`.

`npm run setup` applies only local, idempotent D1 migrations through the `DB` binding and preserves existing data. It does not create remote resources or replace any secret.

To inspect prerequisites without changing local state:

```powershell
npm run setup -- --diagnose
```

Diagnostic mode intentionally exits non-zero when required local secrets are absent or malformed, before it writes local D1 state. It reports only presence and accepted format, never secret values. Never prefix a secret with `VITE_`.

Before a public launch, replace the clearly labelled demonstration profile with real non-secret `VITE_PHOTOGRAPHER_NAME`, `VITE_CONTACT_PHONE`, `VITE_CONTACT_EMAIL`, `VITE_CONTACT_ADDRESS`, and `VITE_SERVICE_AREA` build variables described in [`docs/technical/public-website.md`](docs/technical/public-website.md). The checked-in fallback values are fictional template content for the Cadrora showcase.

## Deployment details

Cloudflare requires a D1 `database_id` and R2 `bucket_name` for a remote Worker binding. To keep this open-source repository portable, those account-specific values are not committed. `npm run deploy` reads the three `CADRORA_*` build variables, writes an ignored temporary Wrangler file, applies migrations through its `DB` binding in non-interactive CI mode, seeds showcase R2 objects with Wrangler's non-interactive `--force` flag, deploys with an ignored three-secret file, then deletes both files. The build therefore remains reproducible without coupling the repository to one Cloudflare account.

Before selecting **Deploy**, generate and retain the admin password locally with `npm run setup:admin-credentials`; provide the resulting HMAC verifier—not the password—as `ADMIN_SECRET_HASH`, its matching random pepper as `AUTH_PEPPER`, the widget's public key as `VITE_TURNSTILE_SITE_KEY`, and the matching private key as `TURNSTILE_SECRET_KEY`. The three server secrets are required and the Worker fails closed without them. The HMAC verifier uses separate domains for admin and gallery credentials and is intentionally inexpensive enough for the Workers Free 10 ms CPU allowance; the former 600,000-iteration PBKDF2 verifier exceeded that per-request budget. `DB`, `MEDIA_BUCKET`, `MODELS_BUCKET`, and `FACE_INDEX` are production bindings. A real gallery remains without facial search until its owner turns on that per-gallery option and indexes its photos.

When upgrading an existing pre-HMAC checkout, run `npm run setup:admin-credentials -- --migrate`. It preserves the recorded `ADMIN_PASSWORD`, adds a stable `AUTH_PEPPER`, and rewrites only the verifier in the ignored artifact without printing any value. Replace both encrypted Cloudflare secrets from that same artifact before deploying the new code.

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
| `npm run setup:admin-credentials` | Write a long password, HMAC-SHA-256 verifier, and 32-byte-or-longer pepper to ignored local artifacts without printing values |
| `npm run dev` | Run the React SPA and Worker in the Workers runtime |
| `npm run check` | Type-check and lint |
| `npm run test` | Run the unit suite once |
| `npm run build` | Build Worker and client artifacts |
| `npm run release:migrate -- --production --confirm` | Apply remote D1 migrations via the `DB` binding only |
| `npm run release:deploy -- --production --confirm` | Build, migrate, and deploy the explicit production target |
| `npm run deploy` | Workers Builds entry point: build, migrate, and deploy production from configured `CADRORA_*` values |
| `npm run deploy:preview` | Build, migrate, and deploy the isolated preview environment |
| `npm run deploy:instance -- --instance alice --hostname alice.example.com --confirm` | Create or reuse isolated resources, deploy another instance, and attach an exact root domain or subdomain |

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
