# Fresh-account deployment rehearsal — Atelier Giulia (2026-09-25)

This is an evidence log, **not a claim that Atelier Giulia is deployed**. It records which parts of the public [deployment guide](../deployment.md) were exercised and what still needs a real account/browser pass. Never add account tokens, Turnstile keys, admin passwords, pepper values, billing details, or unredacted screenshots here.

## Two different paths

| Path | What it tests | Status |
| --- | --- | --- |
| README's recommended **existing repository → Cloudflare Workers Builds** | Cloudflare's repository-import and resource/secret setup forms, then the `npm run deploy` release | Previously used for Cadrora; **not yet repeated on a fresh AtelierGiulia account**. The Atelier Giulia Action does not exercise these forms. |
| Optional **Atelier Giulia GitHub Action → `deploy:instance`** | Account-scoped token, Wrangler resource discovery/creation, migrations, models, Worker Custom Domain, live HTTPS | GitHub verify passed on commit `c6bf468`; deploy was deliberately skipped because its gate and secrets are unset. The new preflight is unit-tested but has **not** called the AtelierGiulia API. |

## Evidence gathered without changing AtelierGiulia

- `npx wrangler whoami` returned only the `HemondFermetures` account. This OAuth login must **not** be used for AtelierGiulia. An account ID in a local `.env.local` does not grant membership or replace the token.
- Public DNS lists Cloudflare nameservers for `ateliergiulia.com`, but no public A record was observed. Nameservers alone do not prove the zone is active in the intended account or that the Worker Custom Domain is attached.
- The GitHub environment `atelier-giulia-production` exists. The account ID from the owner's Dashboard URL was placed in its `CLOUDFLARE_ACCOUNT_ID` secret. A separate, stable Giulia admin password/hash/pepper was generated into the ignored local `.artifacts/instances/atelier-giulia/admin-credentials.env`; only `ADMIN_SECRET_HASH` and `AUTH_PEPPER` were copied into GitHub Environment secrets. No value was printed or committed. The owner must save `ADMIN_PASSWORD` from that local file in a password manager. `CLOUDFLARE_API_TOKEN`, `TURNSTILE_SECRET_KEY`, the public `VITE_TURNSTILE_SITE_KEY` environment variable, and the repository deployment gate remain absent.
- `npm run check`, `npm run test`, and `npm run build` pass with the account/zone preflight tests. `node scripts/instances/deploy.mjs --help` prints the expected syntax. A real Wrangler provision/deploy cannot be exercised until the AtelierGiulia token and Turnstile pair are available.
- The browser-control service returned `failed to start codex app-server: The system cannot find the path specified (os error 3)`. No logged-in Cloudflare screen or screenshot could be inspected. Consequently, the Cloudflare UI labels in the public guide are based on the linked **official Cloudflare documentation** current on this date, not a direct observation of this account.

## Remaining manual verification, in order

1. Open the AtelierGiulia account in Cloudflare and capture the zone **Active** state. Inspect **Storage & databases → R2 → Overview**. If the account requires an R2 checkout/subscription, stop for the owner's billing decision; do not call it free merely because usage may fit an allowance.
2. Create or inspect the Turnstile widget using **Turnstile → Add widget**, verifying hostname and **Managed** mode. Record only that a public sitekey and private secret key were obtained, never the values.
3. Create a scoped user API token through **My Profile → API Tokens → Create Token**, including Zone Read for the account/zone preflight and the documented D1/R2/Vectorize/Workers permissions. Confirm the account ID and `ateliergiulia.com` active zone match. Store the token only in GitHub's protected environment.
4. Complete the GitHub environment secrets and public variable, then enable the **repository** gate and run the Action. Verify preflight occurs **before** any Wrangler creation, then check terminal GitHub/Cloudflare status and exact commit.
5. Open all public routes and `/admin/login`; check admin authentication, D1 site settings, R2 media privacy, model route, gallery flow, and mobile rendering. Confirm DNS, certificate, HTTP→HTTPS redirect, then enable HSTS conservatively and verify its response header.
6. **Separately** rehearse the README's Workers Builds import path in a clean account or disposable isolated project if the claim “anyone can follow this tutorial” is to be validated end to end. Do not mark that path tested merely because the Atelier GitHub Action succeeded.

## Screenshot set to add after real UI access

Screenshots should be cropped/redacted and stored under `docs/images/deployment/` only when they show the live control named below. Avoid copying Cloudflare documentation images into the repository as if they were ours.

| Screenshot | Must show | Must hide |
| --- | --- | --- |
| Account and zone | Correct account selector and `ateliergiulia.com` **Active** | Account identifiers if not needed |
| R2 overview | Whether R2 is enabled; no checkout claim until accepted by owner | Payment methods and billing addresses |
| Turnstile widget form | **Add widget**, hostname, mode | Sitekey and secret key |
| API token permissions | Scoped account/zone and selected permission names | Token value |
| GitHub environment | Secret **names** and public variable name | Every secret value |
| Workers Builds import | Repository selection and Build/Deploy/Root fields | Unrelated repositories or personal data |
| Worker domain and SSL | Custom Domain active, certificate, HTTPS redirect, HSTS settings | Account credentials |

Official label references: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [R2 setup](https://developers.cloudflare.com/r2/get-started/), [Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), and [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
