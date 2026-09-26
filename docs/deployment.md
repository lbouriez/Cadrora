# Deployment guide

After the infrastructure is working, follow [Make the site yours after deployment](after-deployment.md) for contact details, appearance, logo, favicon and content. The deployment steps below do not replace that launch checklist.

This is a deployment preflight for Cadrora. For the product overview and a short setup path, start with the [main README](../README.md); for account-wide free allowances and example bills, see [cost planning](free-tier.md). This guide documents the repository-preserving Cloudflare Workers Builds flow and the separate Deploy Button clone flow. Cadrora is one Worker named `cadrora`, with Vite static assets, D1, private media R2, and a separate model R2 bucket. The public website at `/`, `/services`, `/galleries`, `/contact`, and `/privacy` remains a static asset route; do not place it behind the admin guard or make it depend on gallery availability. Public and admin gallery HTTP routes use `/galleries`; no legacy `/events` alias is registered.

## Current deployment status

`wrangler.jsonc` publishes Vite's `./dist/client` directory through the static-assets binding. It sends `/api/*`, `/media/*`, `/e/*`, `/admin`, `/admin/*`, and `/models/*` through the Worker first. Other paths, including the five marketing pages, use the static-assets binding and SPA fallback.

The checked-in configuration deliberately omits the account-specific D1 ID and R2 bucket names. They are required by Wrangler for a remote binding, so the release scripts materialize an ignored `.cadrora.remote.wrangler.json` from three process/build variables, use it for migration and deploy, and remove it afterward. `wrangler.jsonc` has a production Worker (`cadrora`) and a named preview Worker (`cadrora-preview`). The preview environment explicitly redeclares its non-inherited variables, required secrets, D1 binding, and R2 bindings, so it does not point at production state.

`npm run deploy` builds the production target, runs `wrangler d1 migrations apply DB --remote`, and invokes Wrangler with a temporary three-secret file. Release-script Wrangler processes set `CI=true` after the explicit `--confirm` fence, and showcase R2 uploads pass Wrangler's `--force` flag, so a Workers Build cannot stall on unavailable D1 or R2 terminal prompts. The manual release commands require an explicit target and `--confirm`; neither the local setup script nor diagnostic mode calls Cloudflare. Do not treat a command exit alone as evidence that custom hostnames, secrets, model objects, or Cron delivery work.

When the optional showcase seed is enabled, its idempotent R2 object uploads retry twice after a failed attempt. If Cloudflare still returns a transient R2 error, the build fails safely; rerun the build after checking the provider status. Already uploaded showcase objects may be overwritten without duplicating gallery records or touching a photographer's imports.

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

Use this path when `lbouriez/Cadrora` (or a fork you maintain) must remain the only source repository. Do **not** use the Deploy Button: Cloudflare's button creates a clone in a Git provider account. The Workers Builds labels below were cross-checked against Cloudflare's [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) and [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) guides on 2026-09-25; Atelier Giulia's zone, R2, and Turnstile labels were [observed directly](technical/deployment-rehearsal-2026-09-25.md). The new-account Workers Builds form and screenshots remain unverified, so do not mistake this for a completed visual walkthrough of that **separate** installation path.

1. **Select the intended Cloudflare account.** In the Dashboard account switcher, choose the account that owns the domain, then verify the zone status is **Active**. If you run Wrangler on a workstation, `npx wrangler whoami` must list that account; setting only `CLOUDFLARE_ACCOUNT_ID` in `.env.local` neither logs Wrangler into another account nor changes the account selected in Workers Builds. Never provision through a CLI session showing only another account.
2. **Enable R2 once.** Open **Storage & databases → R2 Object Storage**. If R2 is not active, Cloudflare opens **Get started with R2**, shows **Includes free monthly usage**, then offers **Add R2 subscription to my account**. On the AtelierGiulia screen this displayed **Total Due Now $0.00** and **Due Monthly $0.00 + additional usage**, but also an existing payment card, automatic renewal, and charges above the free monthly allowances. The account owner must review the live terms and click this billing button personally; included free usage does not mean the subscription step can be skipped. Afterward, return to **R2 Object Storage** and confirm the bucket overview opens instead of **Get started with R2**. `npx wrangler r2 bucket list` may validly return an empty list; error `10042` means R2 is disabled.
3. **Create the production resources.** Create D1 `cadrora`, R2 `cadrora-media`, and R2 `cadrora-models`. Both buckets must show **Public Access: Disabled**. Create Vectorize `cadrora-face-index` with **128** dimensions and the **cosine** metric, then create its string metadata index `partition_id`. Copy the D1 UUID from its Overview page; record the two bucket names exactly. The first party configuration binds `FACE_INDEX` to that exact index name.
4. **Create the admin credential and pepper.** Run `npm ci` then `npm run setup:admin-credentials` on a trusted workstation. This command **generates a random password**; it does not prompt you to choose one. It writes the ignored local `.artifacts/setup/admin-credentials.env`. Open that file privately and store the value after `ADMIN_PASSWORD=` in a password manager. Cloudflare gets the matching `ADMIN_SECRET_HASH` and random `AUTH_PEPPER` as two separate encrypted secrets—never the password or the artifact itself. The generator refuses to overwrite its file by default; do not force regeneration for an existing deployment, because a new password/hash/pepper pair would invalidate its current login.
5. **Create Turnstile for the real hostname.** Open **Application security → Turnstile → Add widget manually**; enter a **Widget name**, select `cadrora.com` under **Hostname Management → Hostnames**, keep **Managed** under **Widget Mode**, leave **Skip future security rule challenges for verified visitors** off, then select **Create**. On the resulting screen choose **Integrate the widget yourself**, not **Set up with Spin**; copy **Site key (Click to copy)** and **Secret key (Click to copy)** separately. The private key belongs only in an encrypted secret. Add `www.cadrora.com` only if it will be served. Localhost test keys are not production keys.
6. **Import the existing repository.** In **Workers & Pages**, select **Create application → Get started** beside **Import a repository**, choose the Git account under **Import a repository**, then select the existing `lbouriez/Cadrora` repository. This connects it; it does not fork or create another repository.
7. **Complete the build settings.** Use Worker name `cadrora`, matching `wrangler.jsonc`; Git branch `main`; Build command `npm run build`; Deploy command `npm run deploy`; Root directory `/`. Disable preview/other-branch builds until preview has separate bindings. Leave Cloudflare Access off for the first release. The current Cloudflare documentation calls the final button **Save and Deploy**; if your account shows **Deploy**, review the same values before selecting it.
8. **Complete Build variables and secrets before deployment.** Cloudflare can generate a Workers Builds **API token** automatically; use a dedicated scoped token only if you need to replace that default. Add these non-secret build variables: `CADRORA_D1_DATABASE_ID=<D1 UUID>`, `CADRORA_MEDIA_BUCKET_NAME=cadrora-media`, and `CADRORA_MODELS_BUCKET_NAME=cadrora-models`. Add `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY` as encrypted build secrets. Add `VITE_TURNSTILE_SITE_KEY` and optional public profile `VITE_*` values as normal build variables. Do **not** add `VITE_GA_MEASUREMENT_ID`; configure GA4 later in authenticated Site settings. The click-to-load contact map uses OpenStreetMap without a key; `VITE_GOOGLE_MAPS_EMBED_KEY` is optional public configuration only if you prefer Google for the embed. `CADRORA_SEED_DEMO=true` is only for an intentional showcase deployment and defaults to off. The release materializes the matching runtime gate and the reserved `demo-private` bypass; do not add or enable `DEMO_SHOWCASE_ENABLED` manually. Use the field map below so a secret is not accidentally placed in a public `VITE_*` value. Build values exist only while the build runs; runtime configuration stays in `wrangler.jsonc` and Worker secrets.
9. **Deploy and verify the Worker hostname.** Select **Save and Deploy** (or **Deploy** on a different setup form), wait for the build's terminal success, then run the verification list below. A later push to `main` builds production automatically. Keep branch builds off until preview gets its own D1/R2 values and secret set.
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
| `TURNSTILE_SECRET_KEY` | The private **secret key** for the production Cadrora widget | **Yes** on a setup form with **Encrypt**; otherwise create a build secret | **Application security → Turnstile → Cadrora Production**. Copy the secret key from the widget details; never photograph or document its value. |
| `VITE_TURNSTILE_SITE_KEY` | The matching public **sitekey** for that widget | **No**: normal build variable | **Application security → Turnstile → Cadrora Production**. This value is intentionally sent to the browser build. |
| `CADRORA_SEED_DEMO` | `true` only when the deployment should contain the generated public/private demo galleries and read-only demo login | No | Leave unset for a real photographer. This is a **build-time** flag: it must be present before `npm run build` (or the release command) so the browser bundle includes the demo journeys. Setting only `DEMO_SHOWCASE_ENABLED` at Worker runtime cannot add those cards after compilation. The deploy script enables the gated demo, uploads tracked WebP variants to private R2, then repairs and validates the reserved D1 sample records. |
| `FEATURE_PUBLIC_MEDIA_CACHE` | Optional `true` to use the Cloudflare cache for public gallery photos; default `false` | No | Set as a deployment environment variable and redeploy. The release script copies it into a Worker variable. The flag affects only public display variants; D1 access checks and private-gallery rules remain active. |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Optional restricted public Google Maps Embed API key | No | Leave blank for the keyless, click-to-load OpenStreetMap map. To use Google instead: Google Cloud Console → Maps Embed API → Credentials. Enable billing on that separate Google Cloud project, restrict the key to your site's HTTP referrers and the Maps Embed API, then add it as a public build variable. Google currently lists Embed API usage as free, but the billing-account requirement remains. Either iframe loads only after a visitor clicks to display it. |

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
| `MAX_STORAGE_BYTES` | `9900000000` | Deployment ceiling for stored media variants; leaves about 100 MB of the account's 10 GB R2 Free allowance for models and overhead |
| `MAX_FACES_PER_EVENT` | `10000` | Facial-index declaration cap |
| `MAX_TOTAL_FACES` | `39000` | Instance-wide face-vector ceiling; 39,000 × 128 dimensions stays below Vectorize's 5-million stored-dimension allowance |
| `SITE_DEFAULT_LANG` | `fr` | Declared default-language setting |
| `FEATURE_PUBLIC_MEDIA_CACHE` | `false` | Opt-in public gallery edge cache after D1 authorization; `false` reads R2 directly |

Set secrets only in Cloudflare secret/binding storage. Never place them in a `VITE_*` value, commit them, or paste them into a deployment log.

### Deployment feature flags

`FEATURE_*` variables are non-secret, typed server-side flags. Their defaults are declared in both production and preview `wrangler.jsonc` vars. The shared deployment resolver accepts only `true` or `false` from a matching deployment environment variable and writes the result to the Worker config; an omitted variable keeps the checked-in default. Runtime code reads flags through `featureEnabled` in `src/server/config/featureFlags.ts`, where an absent or malformed binding is disabled. To add another flag, declare its default in both Wrangler environments, add its binding type and typed registry entry, and use the common resolver in the deployment path. Changing a deployment environment variable takes effect after redeployment.

`FEATURE_PUBLIC_MEDIA_CACHE` is off by default. When off, public display reads skip the inner cache entrypoint and go directly from the D1 authorization check to R2. Cache purge jobs still run on public-to-private, offline, and delete transitions because an earlier enabled deployment could have left entries behind. Existing edge entries expire after five minutes; existing browser copies follow the cache lifetime with which they were originally served.

| Secret/binding | Needed for |
| --- | --- |
| `ADMIN_SECRET_HASH` | Password admin mode; it is the versioned admin-domain HMAC verifier produced by the setup command |
| `AUTH_PEPPER` | Secret HMAC key material for admin/event credential verification and domain-separated signed capabilities; minimum 32 random bytes |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile validation for admin login and protected-event unlock, plus face-search cursor signing |
| `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` | Cloudflare Access admin mode only |

Public `VITE_*` values are compiled into the client bundle. Set them as Workers Builds variables in Advanced settings, or in an ignored local `.env`; `.env.example` is the documented key template and should retain no personal values. Contact values normally come from owner-editable D1 Site settings. Optional `VITE_CONTACT_*` and `VITE_SERVICE_AREA` values are outage fallbacks, not the primary configuration; set real values if contact links must work while D1 is unavailable. The opt-in official showcase seeds fictional contact values into D1 for an untouched site, but a normal customer deployment does not. `VITE_TURNSTILE_SITE_KEY` is public but must belong to the same widget as the private `TURNSTILE_SECRET_KEY`.

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

The existing `cadrora.com` production deployment remains unchanged when either additional-instance command is used. A root domain and a subdomain use the same provisioner; only the exact `--hostname` value and the zone prerequisite differ. Before either example, supply `CLOUDFLARE_ACCOUNT_ID` and a **scoped** `CLOUDFLARE_API_TOKEN` from the intended account in the process environment; the script refuses to use an implicit Wrangler OAuth account. It checks through Cloudflare's read-only Zones API that the hostname belongs to an **active zone in that exact account before creating D1/R2/Vectorize resources**. Keep the token out of shell history and the repository.

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

The hostname must already belong to an active zone in the selected Cloudflare account. The root-domain Turnstile widget may cover its subdomains; otherwise add the exact hostname before deployment. The token requires **Zone Read** for the preflight, D1/R2/Vectorize write access, Workers product access, and **Workers Routes Write** for the Custom Domain. It must be scoped to the intended account and zone. An account ID alone does not give an OAuth session access to that account; `npx wrangler whoami` showing only another account is a stop sign. Never store the token in a `VITE_*` variable. See [Cloudflare's current Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/) and [Zones API](https://developers.cloudflare.com/api/resources/zones/methods/list/).

This ownership boundary matters for forks. Your account can create `toto.cadrora.com` only when that same account owns the active `cadrora.com` zone. A fork deployed in somebody else's independent Cloudflare account should use a hostname under a zone that person owns. Delegating `toto.cadrora.com` into another account is possible only as a separate DNS/zone architecture and is intentionally outside this simple deployment command.

Generated private material is ignored below `.artifacts/instances/<instance>/`. Open `admin-credentials.env` in a trusted local editor and store `ADMIN_PASSWORD` in the customer's password manager. The temporary Turnstile deployment-secret file is removed even when deployment fails. The retained manifest and generated Wrangler file contain resource identifiers but no secret values.

The command deploys an empty customer instance and deliberately does not seed the official Cadrora showcase. `CADRORA_SITE` selects a checked-in presentation profile; if omitted, the default Cadrora profile is built. A profile may pin its instance/hostname in `sites/<id>/profile.json`, which the provisioner checks before touching Cloudflare. The hostname is exact: deploying `alice.cadrora.com` does not create a wildcard route and does not alter `cadrora.com`.

This is a local Wrangler provisioning/deployment flow, not a new Workers Builds Git integration. A later customer release is published by updating that fork or checkout and rerunning the same instance command. The optional Atelier Giulia workflow below invokes the same provisioner in GitHub Actions with its own protected secrets; no customer gets that pipeline automatically.

## Atelier Giulia from this repository

This optional maintainer setup publishes the `atelier-giulia` profile to **`ateliergiulia.com` in the AtelierGiulia Cloudflare account**, independent of the existing Cadrora Workers Builds installation. It does not create a fork, change Cadrora's bindings, or make the Worker multi-tenant. Its initial imagery is borrowed from the showcase and is **provisional**; replace it with licensed Atelier Giulia photos before presenting it as Giulia's actual portfolio. No email, phone, address, or service area is invented. Set those in the new site's Admin → Site settings before launch.

The profile manifests in `sites/<id>/profile.json` own build metadata and optional deployment target; `site.ts` owns public copy, image choices, and home composition. `src/app` owns reusable pages and components. A design or functional improvement there reaches both builds automatically. Only a page deliberately replaced by `pages` in one profile needs manual reconciliation. D1 settings edited by the owner remain the runtime source of truth. The Atelier Giulia initial SQL changes only a never-edited default brand row and is safe to rerun.

### One-time setup (manual, before enabling the pipeline)

1. In the Cloudflare Dashboard account switcher, choose **AtelierGiulia**; open **Domains → Overview** and confirm `ateliergiulia.com` is **Active**. Open **Storage & databases → R2 Object Storage**. On a new account, Cloudflare displays **Get started with R2**, **Includes free monthly usage**, **Total Due Now $0.00**, and **Due Monthly $0.00 + additional usage**. The owner must review the payment details and terms, then personally click **Add R2 subscription to my account**. This activation is required even to use R2's monthly free allowances (currently 10 GB stored, 1 million Class A operations, and 10 million Class B operations); usage beyond them can be billed automatically. Return to **R2 Object Storage** and confirm the overview shows **Create bucket**. Cloudflare's Custom Domain operation will later arrange DNS/TLS for the exact hostname; it does not transfer a domain from another account. Do not reuse Cadrora's D1, buckets, Vectorize index, Turnstile keys, admin credentials, or API token.
2. Open **Application security → Turnstile → Add widget manually**. Enter a descriptive **Widget name**, select `ateliergiulia.com` under **Hostname Management → Hostnames**, keep **Managed** under **Widget Mode** and leave **Skip future security rule challenges for verified visitors** off, then select **Create**. On the resulting screen use **Integrate the widget yourself** (Cadrora already implements both sides); copy **Site key (Click to copy)** and **Secret key (Click to copy)**. Cloudflare says the keys can be viewed again later. Do not choose **Set up with Spin** for this project.
3. For the CI credential, use the account-owned token Cloudflare recommends: **Manage account → Account API tokens → Create Token → Start from scratch**. Set **Token name** to `Cadrora Atelier Giulia GitHub deploy`. In the first **Permission policies → Edit policy**, choose **Specified Domains → ateliergiulia.com** and grant **DNS & Zones → Zone → Read** plus **Developer Platform → Workers Routes → Edit**. Select **Add policy**, keep **Entire Account**, and grant **Developer Platform → D1 → Edit**, **Vectorize → Edit**, **Workers R2 Storage → Edit**, and **Workers → Admin**. Workers **Editor** cannot create the first Worker; Admin can, so remove Editor if both were selected. For GitHub-hosted runners, leave **Client IP address filtering** unset. Choose **No expiration** if this persistent CI credential is to remain usable without scheduled rotation, then **Review token** and verify the summary names exactly the two scopes and six permissions above before **Create token**. On **Token created successfully**, Cloudflare warns **This is the only time you will see this token**. Copy only **Your API Token → Copy to clipboard** into GitHub's `CLOUDFLARE_API_TOKEN` environment secret, then select **Confirm**. A second copy in a password manager is optional: GitHub's secret is sufficient for routine deployment, and a lost token can be rolled in Cloudflare and replaced in GitHub. Do **not** copy the separately displayed R2 **Access Key ID** or **Secret Access Key**: this deployment does not use S3 credentials. Never put any key in source or a screenshot. [Cloudflare account-token documentation](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/) covers later rotation or revocation. Copy the account ID from the AtelierGiulia Workers & Pages **Account details** panel. Never use a workstation's implicit Wrangler login here: it may select a different account.
4. For a **new** Atelier Giulia installation, run `npm ci` and `npm run setup:admin-credentials -- --output .artifacts/instances/atelier-giulia/admin-credentials.env` on a trusted workstation. The command generates a random admin password, a stable pepper, and a matching verifier in that ignored file; it does not ask you to choose a password. Open the file privately and store `ADMIN_PASSWORD` in Giulia's password manager. Do not put the password in GitHub; only `ADMIN_SECRET_HASH` and the matching `AUTH_PEPPER` go to encrypted secrets. **Do not run the generator again for an existing site**: replacing the pair would invalidate login and protected-gallery verifiers.
5. In GitHub → repository **Settings → Environments**, open the already-created `atelier-giulia-production` environment (a fork must select **New environment → Configure environment**). Under **Environment secrets**, use **Add environment secret → Name / Value → Add secret** for `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, and `TURNSTILE_SECRET_KEY`. Under **Environment variables**, use **Add environment variable → Name / Value → Add variable** for public `VITE_TURNSTILE_SITE_KEY`; optionally add `FEATURE_PUBLIC_MEDIA_CACHE` with value `true` to enable the public photo cache. Its absent/default value is `false`. Check that each name appears in the proper table; secret values are not shown again. Add an approval reviewer if desired. Under repository **Settings → Secrets and variables → Actions → Variables**, create `ATELIER_GIULIA_DEPLOY_ENABLED` with value `true` only after every item is ready. This gate must be a **repository** variable because the deploy job reads it before entering the environment. See [GitHub's environment-screen guide](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments). Do not paste secret values into workflow YAML, logs, issues, or screenshots.
6. Push reviewed code to `main`; the action first runs checks and builds **both** profiles. Once the account, zone, widget, credentials and GitHub Environment are ready, set the repository gate to `true`, then run **Actions → Atelier Giulia production → Run workflow** on `main`. The deploy job first verifies the account/zone without mutation, then provisions/reuses `cadrora-atelier-giulia` Worker/D1, two private R2 buckets and a Vectorize index, applies migrations and the guarded brand seed, uploads verified models, sets Worker secrets, binds `ateliergiulia.com`, then checks three HTTPS routes. Re-running the same workflow reuses those resources.
7. Open `https://ateliergiulia.com/`, `/services`, `/galleries`, `/contact`, `/privacy`, and `/admin/login` on desktop and phone. Confirm the certificate, real brand, no Cadrora demo login, empty contact fields until configured, and the exact commit's completed GitHub Action. Then enter Giulia's actual coordinates/contact details and publish only licensed photos through her Admin. A green build alone does not prove the hostname or content is ready.

For this maintained Atelier Giulia environment, step 4 has already been completed separately from Cadrora: the stable credentials are in the ignored local `.artifacts/instances/atelier-giulia/admin-credentials.env`, and the matching hash and pepper are already stored as GitHub Environment secrets. Open the local file to find `ADMIN_PASSWORD=` and save that value in a password manager. **Do not regenerate or overwrite that file during deployment**; changing the pepper or hash independently would break existing login and protected-gallery credentials.

### HTTPS, redirects, and HSTS

The Worker Custom Domain supplies DNS and a TLS certificate, but confirm issuance and live HTTPS before turning on HSTS. In the **AtelierGiulia zone → SSL/TLS → Edge Certificates**, confirm the **Universal** certificate for `ateliergiulia.com` is **Active**; an unrelated **Advanced Pending Validation (TXT)** certificate is not proof that the Universal certificate is unavailable. Switch **Always Use HTTPS** on (zone-wide HTTP→HTTPS redirect). In **HTTP Strict Transport Security (HSTS)**, click **Enable HSTS**, review the caution, check **I understand**, and click **Next**. Switch **Enable HSTS (Strict-Transport-Security)** on, choose **1 month** under **Max Age Header (max-age)**, leave **Apply HSTS policy to subdomains (includeSubDomains)** and **Preload** off, then click **Save**. Confirm the card shows **Max-Age: 1 month**. Test that `http://ateliergiulia.com` redirects to `https://ateliergiulia.com`, the HTTPS certificate is trusted, and the response has a `Strict-Transport-Security` header. Increase max-age only after operational confidence. Do **not** enable `includeSubDomains` or preload until every current and future subdomain can serve HTTPS: HSTS is cached by browsers and is hard to undo quickly. These are zone-level manual settings, not promises made by the Worker deploy script. The zone's SSL/TLS encryption mode should not be weakened to Flexible merely to make a redirect pass.

Cloudflare references: [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/), [HSTS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/).

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
