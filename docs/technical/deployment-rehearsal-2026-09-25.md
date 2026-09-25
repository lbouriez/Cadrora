# Fresh-account deployment rehearsal — Atelier Giulia (2026-09-25)

This is an evidence log, **not a claim that Atelier Giulia is deployed**. It records which parts of the public [deployment guide](../deployment.md) were exercised and what still needs a real account/browser pass. Never add account tokens, Turnstile keys, admin passwords, pepper values, billing details, or unredacted screenshots here.

## Two different paths

| Path | What it tests | Status |
| --- | --- | --- |
| README's recommended **existing repository → Cloudflare Workers Builds** | Cloudflare's repository-import and resource/secret setup forms, then the `npm run deploy` release | Previously used for Cadrora; **not yet repeated on a fresh AtelierGiulia account**. The Atelier Giulia Action does not exercise these forms. |
| Optional **Atelier Giulia GitHub Action → `deploy:instance`** | Account-scoped token, Wrangler resource discovery/creation, migrations, models, Worker Custom Domain, live HTTPS | GitHub verify passed on commits `c6bf468` and `7243612`; deploy was deliberately skipped because its gate is unset. The new preflight is unit-tested but has **not** called the AtelierGiulia API. |

## Evidence gathered during the AtelierGiulia setup

- `npx wrangler whoami` returned only the `HemondFermetures` account. This OAuth login must **not** be used for AtelierGiulia. An account ID in a local `.env.local` does not grant membership or replace the token.
- Public DNS lists Cloudflare nameservers for `ateliergiulia.com`, but no public A record was observed. Nameservers alone do not prove the zone is active in the intended account or that the Worker Custom Domain is attached.
- The authenticated Dashboard shows `ateliergiulia.com` **Active** in the **AtelierGiulia** Free account under **Domains → Overview**. Its **Workers & Pages → Account details** shows the intended account ID and no Worker projects yet. This supersedes the DNS-only uncertainty above.
- **Storage & databases → R2 Object Storage** initially opened **Get started with R2**. The subscription screen showed **Includes free monthly usage**, **Total Due Now $0.00**, **Due Monthly $0.00 + additional usage**, and usage-based charges beyond the included allowance. The owner personally clicked **Add R2 subscription to my account**. The authenticated R2 overview now shows **Create bucket**, confirming activation. This does not guarantee a zero bill if usage exceeds the free allowances.
- **Application security → Turnstile → Add widget manually** was exercised. The owner clicked **Create** for the `Atelier Giulia production` widget on `ateliergiulia.com`, with **Managed** mode and pre-clearance off. The resulting **Integrate the widget yourself** screen showed separate site and secret keys. The private `TURNSTILE_SECRET_KEY` is now a GitHub Environment secret; the public `VITE_TURNSTILE_SITE_KEY` is now a GitHub Environment variable. No key value was committed or copied into documentation.
- The GitHub environment `atelier-giulia-production` exists. The account ID from the owner's Dashboard URL was placed in its `CLOUDFLARE_ACCOUNT_ID` secret. A separate, stable Giulia admin password/hash/pepper was generated into the ignored local `.artifacts/instances/atelier-giulia/admin-credentials.env`; only `ADMIN_SECRET_HASH` and `AUTH_PEPPER` were copied into GitHub Environment secrets. The owner must save `ADMIN_PASSWORD` from that local file in a password manager. `CLOUDFLARE_API_TOKEN` and the repository deployment gate remain absent at this checkpoint.
- **Manage account → Account API tokens** was exercised in the browser. The owner confirmed creation of an account-owned token with `ateliergiulia.com` **Zone Read** and **Workers Routes Write**, plus account-scoped **D1 Write**, **Vectorize Write**, **Workers R2 Storage Write**, and **Workers Admin**. A diagnostic output exposed the first unused token, so it was immediately **rolled** in Cloudflare; the old value was invalidated before any deployment. The replacement value was copied without displaying it and is awaiting placement in the GitHub Environment secret. The success screen also displays unrelated R2 S3 keys; this deployment does not use them.
- `npm run check`, `npm run test`, and `npm run build` pass with the account/zone preflight tests. `node scripts/instances/deploy.mjs --help` prints the expected syntax. GitHub verify on commit `269260c` completed successfully; deployment was skipped because the gate is unset. A real Wrangler provision/deploy is pending placement of the replacement token and activation of the gate.
- Browser control initially failed, then recovered. The account, domain, R2, Turnstile, GitHub Environment, and Account API token form labels above were directly observed in the authenticated browser. Screenshots have not yet been saved/redacted; later Workers Builds and SSL/HSTS screens remain unverified.

## Remaining manual verification, in order

1. Transfer the rotated, once-shown token only to GitHub Environment secret `CLOUDFLARE_API_TOKEN` and a password manager; never use the invalidated value or the separately shown R2 S3 keys.
2. Enable the **repository** gate and run the Action after the token is ready. Verify preflight occurs **before** any Wrangler creation, then check terminal GitHub/Cloudflare status and exact commit.
3. Open all public routes and `/admin/login`; check admin authentication, D1 site settings, R2 media privacy, model route, gallery flow, and mobile rendering. Confirm DNS, certificate, HTTP→HTTPS redirect, then enable HSTS conservatively and verify its response header.
4. **Separately** rehearse the README's Workers Builds import path in a clean account or disposable isolated project if the claim “anyone can follow this tutorial” is to be validated end to end. Do not mark that path tested merely because the Atelier GitHub Action succeeded.

## Screenshot set to add after real UI access

Screenshots should be cropped/redacted and stored under `docs/images/deployment/` only when they show the live control named below. Avoid copying Cloudflare documentation images into the repository as if they were ours.

| Screenshot | Must show | Must hide |
| --- | --- | --- |
| Account and zone | Correct account selector and `ateliergiulia.com` **Active** | Account identifiers if not needed |
| R2 overview | Whether R2 is enabled; no checkout claim until accepted by owner | Payment methods and billing addresses |
| Turnstile widget form | **Add widget manually**, hostname, mode | Sitekey and secret key |
| API token permissions | Scoped account/zone and selected permission names | Token value |
| GitHub environment | Secret **names** and public variable name | Every secret value |
| Workers Builds import | Repository selection and Build/Deploy/Root fields | Unrelated repositories or personal data |
| Worker domain and SSL | Custom Domain active, certificate, HTTPS redirect, HSTS settings | Account credentials |

Official label references: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [R2 setup](https://developers.cloudflare.com/r2/get-started/), [Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), and [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
