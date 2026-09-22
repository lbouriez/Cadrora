# Deployment guide

This is a deployment preflight for Cadrora. It documents the repository-preserving Cloudflare Workers Builds flow and the separate Deploy Button clone flow. Cadrora is one Worker named `cadrora`, with Vite static assets, D1, private media R2, and a separate model R2 bucket. The public website at `/`, `/services`, `/galleries`, `/contact`, and `/privacy` remains a static asset route; do not place it behind the admin guard or make it depend on gallery availability. Public and admin gallery HTTP routes use `/galleries`; no legacy `/events` alias is registered.

## Current deployment status

`wrangler.jsonc` publishes Vite's `./dist/client` directory through the static-assets binding. It sends `/api/*`, `/media/*`, `/e/*`, `/admin`, `/admin/*`, and `/models/*` through the Worker first. Other paths, including the five marketing pages, use the static-assets binding and SPA fallback.

The checked-in configuration deliberately omits the account-specific D1 ID and R2 bucket names. They are required by Wrangler for a remote binding, so the release scripts materialize an ignored `.cadrora.remote.wrangler.json` from three process/build variables, use it for migration and deploy, and remove it afterward. `wrangler.jsonc` has a production Worker (`cadrora`) and a named preview Worker (`cadrora-preview`). The preview environment explicitly redeclares its non-inherited variables, required secrets, D1 binding, and R2 bindings, so it does not point at production state.

`npm run deploy` builds the production target, runs `wrangler d1 migrations apply DB --remote`, and invokes Wrangler with a temporary three-secret file. Release-script Wrangler processes set `CI=true` after the explicit `--confirm` fence, and showcase R2 uploads pass Wrangler's `--force` flag, so a Workers Build cannot stall on unavailable D1 or R2 terminal prompts. The manual release commands require an explicit target and `--confirm`; neither the local setup script nor diagnostic mode calls Cloudflare. Do not treat a command exit alone as evidence that custom hostnames, secrets, model objects, or Cron delivery work.

The checked-in configuration has one Cron Trigger, every 15 minutes. Its Worker handler enqueues expired face purges and runs up to 25 maintenance jobs. Confirm the trigger is active on the deployed Worker; source presence is not runtime evidence.

### Cloudflare resource glossary

| Cloudflare term | Plain-language meaning in Cadrora | What belongs there |
| --- | --- | --- |
| D1 database | A small SQL database, similar to the application's catalog and control panel | Events, visibility/access rules, photo metadata, hashes, sessions, import state, counters, and cleanup jobs. No image files. |
| R2 bucket | Private object/file storage, similar to a cloud hard drive | `cadrora-media` stores gallery image variants; `cadrora-models` stores checksum-pinned face-search model files. |
| Vectorize index | A numeric similarity index, not file storage | `cadrora-face-index` stores 128-value face vectors for one event-scoped search namespace at a time. It never stores a selfie image. |
| Binding | The named connection from the Worker code to a D1/R2/Vectorize resource | `DB`, `MEDIA_BUCKET`, `MODELS_BUCKET`, and `FACE_INDEX` are the names used by the code. The configuration connects each name to the resource you created. |
| D1 UUID | Cloudflare's unique identifier for one database | Copy it from the D1 Overview page into `CADRORA_D1_DATABASE_ID`; it is not the display name. |

R2 buckets stay private. Cadrora's Worker reads from them and checks gallery authorization before returning media. Never enable an R2 public development URL or custom bucket domain for `cadrora-media`.

## Existing-repository Cloudflare Builds

Use this path when `lbouriez/Cadrora` (or a fork you maintain) must remain the only source repository. Do **not** use the Deploy Button: Cloudflare's button creates a clone in a Git provider account.

1. **Select the intended Cloudflare account.** It must own the production zone. `npx wrangler whoami` should show that account. If a multi-account workstation selects the wrong one, use ignored `.env.local` with `CLOUDFLARE_ACCOUNT_ID=<target-account-id>`; never commit it.
2. **Enable R2 once.** Open **Storage & databases → R2 Object Storage**. If the page says **Get started with R2**, the account owner must review the current pricing and accept that account-level service/billing action. `npx wrangler r2 bucket list` may validly return an empty list; error `10042` means R2 is disabled.
3. **Create the production resources.** Create D1 `cadrora`, R2 `cadrora-media`, and R2 `cadrora-models`. Both buckets must show **Public Access: Disabled**. Create Vectorize `cadrora-face-index` with **128** dimensions and the **cosine** metric, then create its string metadata index `partition_id`. Copy the D1 UUID from its Overview page; record the two bucket names exactly. The first party configuration binds `FACE_INDEX` to that exact index name.
4. **Create the admin credential and pepper.** Run `npm ci` then `npm run setup:admin-credentials` on a trusted workstation. Store `ADMIN_PASSWORD` from the ignored artifact in a password manager. Cloudflare gets the matching `ADMIN_SECRET_HASH` and random `AUTH_PEPPER` as two separate encrypted secrets—never the password or the artifact itself.
5. **Create Turnstile for the real hostname.** Use a Managed widget with `cadrora.com`; add `www.cadrora.com` only if it will be served. The root hostname allows its subdomains; a subdomain does not allow the root. Record the public site key and private secret key. Localhost test keys are not production keys.
6. **Import the existing repository.** In **Workers & Pages**, choose **Create application → Continue with GitHub**, select `lbouriez/Cadrora`, then **Next**. This connects the existing repository; it does not fork or create another repository.
7. **Complete the setup page.** Set Project name `cadrora`; Build command `npm run build`; Deploy command `npm run deploy`; turn **off** *Builds for non-production branches*. Leave Cloudflare Access off for the first release.
8. **Complete Advanced settings.** Create/select a dedicated Workers Builds API token. Add these non-secret build variables: `CADRORA_D1_DATABASE_ID=<D1 UUID>`, `CADRORA_MEDIA_BUCKET_NAME=cadrora-media`, and `CADRORA_MODELS_BUCKET_NAME=cadrora-models`. Add `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY` as encrypted build secrets. Add `VITE_TURNSTILE_SITE_KEY` and optional public profile `VITE_*` values as normal build variables. `VITE_GA_MEASUREMENT_ID` is an optional public GA4 ID; no Google resource loads before consent. `CADRORA_SEED_DEMO=true` is only for an intentional showcase deployment and defaults to off. The release materializes the matching runtime gate and the reserved `demo-private` bypass; do not add or enable `DEMO_SHOWCASE_ENABLED` manually. Use the field map below so a secret is not accidentally placed in a public `VITE_*` value. Build values exist only while the build runs; runtime configuration stays in `wrangler.jsonc` and Worker secrets.
9. **Deploy and verify the Worker hostname.** Select **Deploy**, wait for the build to finish, then run the verification list below. A later push to `main` builds production automatically. Keep branch builds off until preview gets its own D1/R2 values and secret set.
10. **Attach the domain after the Worker works.** In the Worker's **Settings → Domains & Routes**, add `cadrora.com` as a custom domain. Confirm DNS and TLS are active, then repeat the verification list on that hostname. Adding `www` serves the Worker but does not make it redirect; add a redirect rule only if that is desired.

The account owner must personally review any billing confirmation, API-token creation, domain replacement warning, and secret transmission. A successful local build or visible GitHub repository does not prove those manual account steps are complete.

### Cloudflare setup form: exact field map

Do not place actual values in this public repository or in a ticket/screenshot. The table identifies where each value comes from and whether the Cloudflare setup page's **Encrypt** action is required.

| Cloudflare setup field | Value to enter | Encrypt? | Where to retrieve it safely |
| --- | --- | --- | --- |
| `CADRORA_D1_DATABASE_ID` | The UUID of the production `cadrora` D1 database | No | **Storage & databases → D1 → cadrora → Overview** |
| `CADRORA_MEDIA_BUCKET_NAME` | `cadrora-media` (or the exact private media bucket name chosen for this deployment) | No | **Storage & databases → R2** |
| `CADRORA_MODELS_BUCKET_NAME` | `cadrora-models` (or the exact private models bucket name chosen for this deployment) | No | **Storage & databases → R2** |
| `ADMIN_SECRET_HASH` | The value after `ADMIN_SECRET_HASH=` in the ignored `.artifacts/setup/admin-credentials.env` produced by `npm run setup:admin-credentials` | **Yes**: paste it, then select **Encrypt** | Trusted local editor only. Do **not** enter `ADMIN_PASSWORD`; store that password in a password manager. |
| `AUTH_PEPPER` | The matching value after `AUTH_PEPPER=` in the same ignored credential artifact; it represents at least 32 random bytes | **Yes**: paste it, then select **Encrypt** | Trusted local editor only. Keep it separate from the verifier and rotate both together. Never put it in a `VITE_*` variable. |
| `TURNSTILE_SECRET_KEY` | The private **Secret key** for the production Cadrora widget | **Yes**: paste it, then select **Encrypt** | **Application security → Turnstile → Cadrora Production**. Open the existing widget and copy **Secret key**. If the initial creation page was closed, this is the normal recovery path. |
| `VITE_TURNSTILE_SITE_KEY` | The matching public **Site key** for that widget | **No**: normal build variable | **Application security → Turnstile → Cadrora Production**. This value is intentionally sent to the browser build. |
| `CADRORA_SEED_DEMO` | `true` only when the deployment should contain the generated public/private demo galleries and read-only demo login | No | Leave unset for a real photographer. This is a **build-time** flag: it must be present before `npm run build` (or the release command) so the browser bundle includes the demo journeys. Setting only `DEMO_SHOWCASE_ENABLED` at Worker runtime cannot add those cards after compilation. The deploy script enables the gated demo, uploads tracked WebP variants to private R2, then repairs and validates the reserved D1 sample records. |
| `VITE_GA_MEASUREMENT_ID` | Optional GA4 Measurement ID such as `G-XXXXXXXXXX` | No | Google Analytics → Web data stream. It is public configuration; the script loads only after explicit analytics consent. |

After entering each of the three secrets, the setup page should show it as encrypted/hidden. If one does not, do not deploy: remove the value and enter it again using **Encrypt**. A Turnstile secret key, auth pepper, admin password, API token, or local credential artifact must never be committed, sent as a public build variable, or copied into documentation.

### Deploy Button setup page

The Deploy Button opens the same resource-and-secret setup form, but it also creates an independent repository clone. Use it only when that clone is intentional; maintainers of the existing `lbouriez/Cadrora` repository should follow [Existing-repository Cloudflare Builds](#existing-repository-cloudflare-builds) instead.

On the button's **Set up your application** page, create or select separate production D1 and private R2 resources, then fill every field in the table above. For the three secret fields, paste `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY` one at a time and select **Encrypt** after each paste. `AUTH_PEPPER` must come from the same `npm run setup:admin-credentials` run as `ADMIN_SECRET_HASH`; generating or copying only one of them makes password verification fail closed. Enter `VITE_TURNSTILE_SITE_KEY` as a normal public variable, not an encrypted secret. Review the repository visibility and all account-level resource choices before selecting **Deploy**.

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

For a fresh checkout, `npm run setup:local` generates ignored local admin credentials and a random pepper, configures Cloudflare's official test-only Turnstile pair, and applies the local migrations without printing credential values. It refuses to replace an existing `.env`, `.dev.vars`, or credential artifact. For an existing or manually managed environment, use `npm run setup:admin-credentials`, copy the generated verifier and matching pepper into ignored `.dev.vars`, add the matching Turnstile values, and run `npm run setup`. Diagnostic mode validates the versioned HMAC verifier, the minimum pepper length, and source-declared `DB`, `MEDIA_BUCKET`, and `MODELS_BUCKET` bindings without exposing values. It deliberately fails before local D1 work when a required secret is absent or malformed.

For an installation created before `AUTH_PEPPER` existed, run `npm run setup:admin-credentials -- --migrate` against the existing ignored credential artifact. The command refuses a missing `ADMIN_PASSWORD`, preserves that password exactly, generates or reuses a 32-byte pepper, and recalculates the verifier without printing values. Update both encrypted `AUTH_PEPPER` and `ADMIN_SECRET_HASH` in Cloudflare Builds before pushing code that requires them; updating only one makes authentication fail closed.

## Required Worker bindings

Provision and bind the resources named in `wrangler.jsonc` before setting deployment credentials:

| Binding | Current role | Required state |
| --- | --- | --- |
| `ASSETS` | Vite static assets and SPA fallback | Required |
| `DB` | Authoritative D1 data, sessions, events, imports, jobs | Required |
| `MEDIA_BUCKET` | Private image variants | Required |
| `MODELS_BUCKET` | Immutable YuNet and SFace model objects | Required private R2 binding; objects are added only if face search is enabled |
| `FACE_INDEX` | Event-scoped Vectorize facial-search index | Bound to `cadrora-face-index`; production needs the `partition_id` metadata index. |

The [Deploy to Cloudflare button](https://developers.cloudflare.com/workers/platform/deploy-buttons/) is an independent-clone path, not the existing-repository path. It creates a generated repository in the deployer's Git provider account. Keep preview and production resources separate—never point a preview at production media or D1. Cloudflare binding configuration and non-inherited environment rules are documented in the [Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/) and [environment guide](https://developers.cloudflare.com/workers/wrangler/environments/).

Before the first deployment to a fresh account, complete the [existing-repository checklist](#existing-repository-cloudflare-builds). D1 and Turnstile must be accessible in the selected account and R2 must already be enabled.

## Variables and secrets

The Worker configuration declares these non-secret variables:

| Name | Checked-in default | Runtime meaning |
| --- | --- | --- |
| `ADMIN_AUTH_MODE` | `password` | `password` or `cloudflare-access`; there is no open mode |
| `SESSION_TTL_H` | `8` | Password and event-grant lifetime; accepted password-session range is 1–24 hours |
| `MAX_PHOTOS_PER_EVENT` | `2000` | Maximum photos in one gallery |
| `MAX_EVENTS` | `50` | Maximum separate galleries; this is a conservative product ceiling, not a Cloudflare resource quota |
| `MAX_STORAGE_BYTES` | `9900000000` | Deployment ceiling for stored media variants; leaves about 100 MB of the account's 10 GB R2 Free allowance for models and overhead |
| `MAX_FACES_PER_EVENT` | `10000` | Facial-index declaration cap |
| `MAX_TOTAL_FACES` | `39000` | Instance-wide face-vector ceiling; 39,000 × 128 dimensions stays below Vectorize's 5-million stored-dimension allowance |
| `SITE_DEFAULT_LANG` | `fr` | Declared default-language setting |

Set secrets only in Cloudflare secret/binding storage. Never place them in a `VITE_*` value, commit them, or paste them into a deployment log.

| Secret/binding | Needed for |
| --- | --- |
| `ADMIN_SECRET_HASH` | Password admin mode; it is the versioned admin-domain HMAC verifier produced by the setup command |
| `AUTH_PEPPER` | Secret HMAC key material for admin/event credential verification and domain-separated signed capabilities; minimum 32 random bytes |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile validation for admin login and protected-event unlock, plus face-search cursor signing |
| `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` | Cloudflare Access admin mode only |

Public `VITE_*` values are compiled into the client bundle. Set them as Workers Builds variables in Advanced settings, or in an ignored local `.env`; `.env.example` is the documented key template and should retain no personal values. The source includes clearly labelled fictional contact fallbacks for the showcase; replace them for a real deployment. `VITE_TURNSTILE_SITE_KEY` is public but must belong to the same widget as the private `TURNSTILE_SECRET_KEY`.

## Models and optional face search

Run the repository’s model verification script before any authorized upload:

```powershell
node scripts/models/download.mjs
```

It writes verified artifacts under ignored `.artifacts/models/` and records exact destination keys in `upload-manifest.json`. The official demo release runs that verification and uploads the exact two allowlisted `models/v1/...` objects automatically. The Worker serves only these public immutable routes while the bucket itself remains private. Facial search also needs `FACE_INDEX` and the `partition_id` Vectorize metadata index; a gallery remains available when an operator leaves its per-event face-search option off.

## Additional isolated domain or subdomain

Choose the deployment shape explicitly:

| Intended result | Command/path | Cloudflare zone requirement |
| --- | --- | --- |
| Replace or upgrade the existing primary site such as `cadrora.com` | Keep the existing Workers Builds `npm run deploy` flow and its already attached Custom Domain | The primary domain is already an active zone in the selected account |
| Add an isolated site on a new root domain such as `alice-photography.com` | `npm run deploy:instance -- --instance alice --hostname alice-photography.com --confirm` | `alice-photography.com` must first be an active zone in the selected account |
| Add an isolated site below an existing domain such as `alice.cadrora.com` | `npm run deploy:instance -- --instance alice --hostname alice.cadrora.com --confirm` | The parent `cadrora.com` zone must be active in the selected account |

The existing `cadrora.com` production deployment remains unchanged when either additional-instance command is used. A root domain and a subdomain use the same provisioner; only the exact `--hostname` value and the zone prerequisite differ.

Subdomain example:

```powershell
$env:VITE_TURNSTILE_SITE_KEY = '<public site key valid for the hostname>'
$env:TURNSTILE_SECRET_KEY = '<matching private key>'
npm run deploy:instance -- --instance alice --hostname alice.cadrora.com --confirm
```

Root-domain example:

```powershell
$env:VITE_TURNSTILE_SITE_KEY = '<public site key valid for the hostname>'
$env:TURNSTILE_SECRET_KEY = '<matching private key>'
npm run deploy:instance -- --instance alice --hostname alice-photography.com --confirm
```

The instance name uses lowercase letters, digits, and internal hyphens. The command deterministically creates or reuses `cadrora-alice` D1 and Worker resources, `cadrora-alice-media`, `cadrora-alice-models`, and `cadrora-alice-face-index`, adds the `partition_id` metadata index, generates a private per-instance admin credential artifact, builds the current fork, applies migrations, uploads checksum-verified models, deploys the Worker, and attaches the exact Custom Domain. Cloudflare creates DNS and TLS for that hostname. Re-running the same command reuses those resources; it does not modify the original `cadrora` resources. Once a local instance manifest exists, the command refuses to reuse that instance name for another hostname; choose a new instance name instead.

The hostname must already belong to an active zone in the selected Cloudflare account. The root-domain Turnstile widget may cover its subdomains; otherwise add the exact hostname before deployment. Wrangler must be authenticated with the target account. When interactive OAuth cannot enumerate D1, set `CLOUDFLARE_ACCOUNT_ID` and a scoped `CLOUDFLARE_API_TOKEN` with D1, R2, Vectorize, Workers Scripts, Workers Routes/Custom Domains, zone-read, and certificate permissions. Never store that token in a `VITE_*` variable.

Generated private material is ignored below `.artifacts/instances/<instance>/`. Open `admin-credentials.env` in a trusted local editor and store `ADMIN_PASSWORD` in the customer's password manager. The temporary Turnstile deployment-secret file is removed even when deployment fails. The retained manifest and generated Wrangler file contain resource identifiers but no secret values.

The command deploys an empty customer instance and deliberately does not seed the official Cadrora showcase. Public profile values still come from the current fork/build, so changing the customer frontend before running the command remains the simplest customization model. The hostname is exact: deploying `alice.cadrora.com` does not create a wildcard route and does not alter `cadrora.com`.

This command provisions resources but does not implement fleet management or deletion. The possible future, separately deployed operator project is documented in [`future-operator-control-plane.md`](future-operator-control-plane.md).

## Deployment and release checks

After all resources, bindings, secrets, remote migration practice, and model objects are verified, select one explicit target:

```powershell
npm run release:migrate -- --env preview --confirm
npm run release:deploy -- --env preview --confirm
npm run release:deploy -- --production --confirm
```

The deployment command builds first, applies ordered migrations remotely by the generated `DB` binding, then deploys. For preview, it sets `CLOUDFLARE_ENV=preview` while building; the Cloudflare Vite plugin writes a preview-targeted deployment configuration, so a production build artifact is never reused for preview. Cloudflare’s D1 migration command performs a backup and rolls back the current migration on failure, but it is not an application restore procedure. `npm run deploy` is reserved for the Workers Builds production command. Do not run any release command from an unreviewed branch or without a protected change record.

Confirm in the deployed environment that:

- `/` and `/contact` work without an API response, login, tracker, form provider, map, or remote font.
- `/api/*` returns JSON errors rather than SPA HTML.
- `/admin` and `/admin/*` are Worker-guarded on the custom hostname, preview hostname, and `workers.dev` hostname.
- A protected gallery and its `/media/*` URL reject requests without a current grant.
- Public and protected cache headers match [`technical/contracts.md`](technical/contracts.md).
- The two model URLs return the expected immutable objects only when face search is intentionally configured.

### Turnstile and gallery-unlock troubleshooting

Use the response `requestId` and the safe error `code`; never capture the submitted password, Turnstile token, secret key, pepper, cookie, or stored verifier.

| Safe code | Meaning | Checks that do not expose secrets |
| --- | --- | --- |
| `TURNSTILE_FAILED` | Cloudflare evaluated the token but did not accept it | Confirm the widget hostname includes the exact deployed hostname, the public site key and encrypted secret key belong to the same widget, and the token is fresh. Complete a new challenge; tokens are single-use and expire. |
| `TURNSTILE_UNAVAILABLE` | The challenge service, network call, or required server configuration was unavailable | Confirm `TURNSTILE_SECRET_KEY` exists as an encrypted secret, the client has the matching `VITE_TURNSTILE_SITE_KEY`, and Cloudflare status/network access is healthy. Retry later rather than bypassing the check. |
| `INVALID_EVENT_PASSWORD` | Turnstile passed, but the protected-event password did not match | Confirm the intended event and password. For a real event, rotate its password through the admin path instead of editing D1. |
| `EVENT_PASSWORD_UNAVAILABLE` | The Worker could not safely verify the event credential | Confirm `AUTH_PEPPER` is present, at least 32 bytes, and belongs to the deployment that created the stored verifier. Redeploy with the matching encrypted values; do not weaken the route or reveal the verifier. |
| `EVENT_GRANT_UNAVAILABLE` | The password matched but the scoped grant could not be issued or restored | Confirm `AUTH_PEPPER`, cookie/security headers, hostname, and access-version state. Clear only the affected Cadrora grant cookie and retry a fresh challenge. |

When Cloudflare Siteverify details are available to an authorized operator, retain only its safe `error-codes` value: `invalid-input-secret` points to the wrong private widget key; `invalid-input-response` or `timeout-or-duplicate` points to an invalid, expired, or already-used browser token; and `internal-error` is a transient Cloudflare validation failure. Never retain or copy the token, secret, submitted password, pepper, cookie, or visitor IP. See Cloudflare's [Siteverify error-code reference](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#error-codes).

The published `demo-private` password is intentionally handled only by the explicitly enabled showcase gate. If it fails, first confirm `CADRORA_SEED_DEMO=true` was present during deployment and the seed completed. Do not enable the showcase gate to repair a real protected gallery.

There is no automated remote smoke test, deployment approval workflow, or application rollback command in this repository. Record the deployed version and resource identities in the operator’s protected change record before declaring a release complete.
