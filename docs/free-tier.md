# Free-tier planning

**Snapshot checked 2026-09-20.** Cloudflare prices and quotas change; use the linked official pages and the Cloudflare dashboard before approving a launch. These are provider allowances, not a promise that Cadrora will remain free or that a request will succeed after a limit is reached.

## Relevant Cloudflare allowances

| Service | Current free-plan figure | Cadrora implication |
| --- | --- | --- |
| Workers | 100,000 requests/day; 10 ms CPU/request; 50 subrequests/request | Worker-first APIs, media authorization, event crawler paths, admin pages, and model delivery count where they invoke the Worker. Image encoding deliberately stays in the browser. |
| D1 | 5 million rows read/day; 100,000 rows written/day; 5 GB total storage | Import and gallery queries must remain indexed and bounded. Daily limits are enforced; query volume is not the same as HTTP request volume. |
| R2 Standard | 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month, free egress | Each variant write/delete is an operation; a five-variant photo multiplies storage and writes. The application default is 10 GiB, which is not the same unit or guarantee as 10 GB-month. |
| Vectorize | 30 million queried vector dimensions/month and 5 million stored dimensions | Face search is optional. Its 128-dimension vectors, partition fan-out, and provider accounting require monitoring before enabling it at scale. |
| Turnstile | Free plan; up to 20 widgets/account; unlimited challenge/verification requests; 10 hostnames/widget | Cadrora uses it only for login and protected-event unlock. Configure hostnames for every intended custom/preview hostname. |

Sources checked on 2026-09-20: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/), and [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/).

The 10 ms Workers Free CPU allowance is also an authentication design constraint, not just a capacity number. A 600,000-iteration PBKDF2 check can exceed that request budget even when the password is correct. Cadrora therefore uses domain-separated HMAC-SHA-256 verifiers keyed by a random, Worker-only `AUTH_PEPPER` of at least 32 bytes. This keeps verification within the target budget while Turnstile, per-IP limiting, strong generated passwords, and pepper confidentiality provide the surrounding protection.

## Application limits are separate

`MAX_PHOTOS_PER_EVENT`, `MAX_EVENTS`, `MAX_STORAGE_BYTES`, and `MAX_FACES_PER_EVENT` are runtime guards set in `wrangler.jsonc`; `MAX_EVENTS` is enforced when an administrator creates an event. They do not reserve Cloudflare capacity, create billing alerts, prevent all provider charges, or account for every operation.

## Cost and reliability risks

- The Worker fails closed for missing required auth, secrets, or access classification. Provider quota exhaustion may therefore make a feature unavailable rather than silently public.
- R2 egress being free does not make storage or operations free. Downloads, imports, delete retries, and browser replays matter.
- D1 charges and limits use rows read/written, including scans and indexes, not merely returned rows.
- Vectorize billing is based on stored and queried vector dimensions. A top-K or fan-out decision can change usage materially.
- The repository has no billing-alert setup, usage-budget automation, Cloudflare Analytics export, or cost dashboard.

## Launch decision

Use free tier only after a representative import, gallery view, protected unlock, download, deletion, and—if enabled—face search are measured in the target Cloudflare account. Record the actual plan, usage dashboard date, application caps, and a paid-plan escalation decision. Do not promise unlimited galleries, unlimited storage, or free service in customer copy.
