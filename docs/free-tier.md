# Cloudflare free-tier and cost planning

Start with the [project overview](../README.md) if you are new to Cadrora; follow the [deployment guide](deployment.md) for account setup. This page explains Cloudflare allowances, Cadrora's own safety ceilings, and example monthly costs. All amounts below are **US dollars** before tax and exclude the domain name and optional third-party services.

**Snapshot checked 2026-09-23.** Cloudflare prices and quotas change; use the linked official pages and the Cloudflare dashboard before approving a launch. These are provider allowances, not a promise that Cadrora will remain free or that a request will succeed after a limit is reached.

## Relevant Cloudflare allowances

| Service | Current free-plan figure | Cadrora implication |
| --- | --- | --- |
| Workers | 100,000 requests/day; 10 ms CPU/request; 50 subrequests/request | Worker-first APIs, media authorization, event crawler paths, admin pages, and model delivery count where they invoke the Worker. Image encoding deliberately stays in the browser. |
| D1 | 5 million rows read/day; 100,000 rows written/day; 500 MB/database, 5 GB/account, and 10 databases/account | Import and gallery queries must remain indexed and bounded. Daily limits are enforced; query volume is not the same as HTTP request volume. One isolated instance consumes one of the ten Free databases. |
| R2 Standard | 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month, free egress | Each variant write/delete is an operation; a five-variant photo multiplies storage and writes. Cadrora reserves roughly 100 MB from the 10 GB decimal allowance for its checksum-pinned models and overhead. |
| Vectorize | 30 million queried vector dimensions/month and 5 million stored dimensions | Face search is optional. Its 128-dimension vectors, partition fan-out, and provider accounting require monitoring before enabling it at scale. |
| Turnstile | Free plan; up to 20 widgets/account; unlimited challenge/verification requests; 10 hostnames/widget | Cadrora uses it for login and protected-gallery unlock. Configure hostnames for every intended custom/preview hostname. |

Sources checked on 2026-09-23: [Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/), and [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/).

Cloudflare's Workers pricing page currently contains a contradictory sentence saying Vectorize is Paid-only while its table lists a Free allocation. The [dedicated Vectorize pricing page](https://developers.cloudflare.com/vectorize/platform/pricing/) explicitly documents Free usage. Confirm availability in the intended account before relying on it.

## Monthly price examples

The following is a **planning model, not a bill forecast or load test**. All galleries and their photos remain stored for a full 30-day month. Each photo consumes an assumed **2 MB total across its stored R2 image variants**—not 2 MB per variant—and models/overhead add **0.1 GB** to the account's R2 storage. Original source files are not included. Real variants depend on source size and import settings: measure a representative gallery in R2 before scaling up. R2 Standard's storage allowance is 10 GB-month **across all buckets in the account**. Cloudflare rounds billable R2 GB-months up to whole units; the examples use that rounding after the free allowance.

The traffic model stays below the shown Workers, R2, D1, and Vectorize included operation amounts. For the large example, suppose at most 1 million dynamic Worker requests, 2 million R2 reads, 250,000 R2 writes on first import (five objects/photo), and 10,000 face-search queries in the month. Those are assumptions, not measured Cadrora traffic. For Vectorize, Cloudflare's published example counts queried dimensions as `(stored vectors + queries) × 128`; a different fan-out or index usage pattern must be checked against actual provider metrics. D1 row reads/writes depend on query plans, indexes, and user behaviour rather than just photo count, so we assume they remain within the relevant included amounts and **do not assign them a fabricated per-photo price**.

| Profile | Galleries × photos | Faces/photo → stored faces | R2 GB-month | Illustrative monthly amount |
| --- | ---: | ---: | ---: | ---: |
| Starting out | 3 × 300 = 900 | 1 → 900 | 900 × 0.002 + 0.1 = **1.9 GB** | **$0** if every Free limit holds |
| Growing studio | 15 × 600 = 9,000 | 2 → 18,000 | 9,000 × 0.002 + 0.1 = **18.1 GB** | **~$0.14** R2 on Workers Free, or **~$5.14** with Workers Paid |
| Established studio | 50 × 1,000 = 50,000 | 3 → 150,000 | 50,000 × 0.002 + 0.1 = **100.1 GB** | **~$6.37** with Workers Paid |

The growing studio's R2 calculation is `ceil(18.1 − 10) × $0.015 = 9 × $0.015 = $0.135`, displayed as ~$0.14. R2 is separately metered even if the Worker remains on its Free plan; remaining on Free still requires raising Cadrora's media ceiling and staying within the Free daily/runtime and D1/Vectorize limits. Workers Paid costs **at least $5 per account per month** and includes 10 million dynamic requests plus 30 million CPU milliseconds per month before usage charges. Static assets served directly do not count as dynamic Worker requests. The Paid plan is **not** automatically required merely because R2 storage passes 10 GB.

The established studio's R2 calculation is `ceil(100.1 − 10) × $0.015 = 91 × $0.015 = $1.365`. Its 150,000 indexed faces at 128 dimensions use **19.2 million stored dimensions**. Workers Paid includes 10 million; the example's stored-dimension overage is `(19.2m − 10m) × $0.05 / 100m ≈ $0.0046`. With the assumptions above, queried dimensions are `(150,000 + 10,000) × 128 = 20.48m`, below Paid's 50m included. Thus `$5 + $1.365 + ~$0.0046 ≈ $6.37/month`. Cloudflare's actual invoice rounding may vary. In a busy month, R2 reads/writes, Worker requests/CPU, D1, and Vectorize queries can all add cost; [official pricing](https://developers.cloudflare.com/workers/platform/pricing/) is the source of truth.

The large case **cannot be reached with the checked-in Cadrora ceilings**. Fifty galleries are allowed, and each gallery may have 2,000 photos, but `MAX_STORAGE_BYTES` limits media to 9.9 GB and `MAX_TOTAL_FACES` limits the instance to 39,000 indexed faces. You must consciously raise those values in production and preview `wrangler.jsonc`, redeploy, and choose an appropriate Cloudflare plan. Vectorize Free stops at 5 million stored dimensions (about 39,062 faces at 128 dimensions); 150,000 faces need Paid. D1 Free also caps one database at 500 MB; verify that a 50,000-photo database fits the Paid per-database limit and performs acceptably before importing that much data. Cadrora's settings page cannot override a lower deployment ceiling.

### What changes the estimate?

- **Actual file size.** For 50,000 photos, 1 MB/photo plus 0.1 GB models is 50.1 GB-month (~$0.62 R2 storage after free and rounding), while 8 MB/photo plus models is 400.1 GB-month (~$5.87 R2 storage). Originals or larger download variants can dominate this calculation.
- **Audience activity.** Photo views, downloads, imports, and retries consume R2 operations and Worker requests. R2 has 1 million free Class A writes and 10 million free Class B reads per month, then Standard rates of $4.50/million A and $0.36/million B. Egress from R2 is free, but those operations are not.
- **Database and search load.** D1 counts rows *read or written*, including scanned rows and index writes, not just SQL calls. Vectorize counts stored and queried dimensions. Check the Cloudflare dashboard after a representative import and a public gallery visit.
- **Other projects.** Free allowances and the Workers Paid subscription are at account level. Another Worker, bucket, D1 database, or Vectorize index in the same account changes available headroom. Preview resources also use that account's pools.
- **Time retained.** R2 GB-month is based on storage over the billing period. Deleting a gallery fences access immediately, then asynchronously removes gallery-owned R2 objects and Vectorize records; future storage use falls after cleanup. An *offline* gallery remains stored and continues to count. Deletion does not refund prior storage time and may add D1 write work.

For a cautious first release, import one representative gallery, record R2 bytes and object counts plus D1/Worker/Vectorize dashboard metrics, then substitute those measured values into this model. Cloudflare's [R2 pricing calculator](https://r2-calculator.cloudflare.com/) can help test different storage and traffic assumptions. See the [admin guide](admin-guide.md) for gallery lifecycle and the [deployment guide](deployment.md) for changing instance limits.

The 10 ms Workers Free CPU allowance is also an authentication design constraint, not just a capacity number. A 600,000-iteration PBKDF2 check can exceed that request budget even when the password is correct. Cadrora therefore uses domain-separated HMAC-SHA-256 verifiers keyed by a random, Worker-only `AUTH_PEPPER` of at least 32 bytes. This keeps verification within the target budget while Turnstile, per-IP limiting, strong generated passwords, and pepper confidentiality provide the surrounding protection.

## Application limits are separate

`MAX_PHOTOS_PER_EVENT`, `MAX_EVENTS`, `MAX_STORAGE_BYTES`, `MAX_FACES_PER_EVENT`, and `MAX_TOTAL_FACES` are deployment ceilings set in `wrangler.jsonc`. Site settings lets the owner choose lower instance limits for galleries, stored media, and stored face vectors. Creation, upload, and indexing routes enforce the effective lower limit server-side. Reducing a limit below current usage does not delete data; it blocks additional writes.

`MAX_EVENTS=50` means 50 separate galleries, not 50 photographs. `MAX_PHOTOS_PER_EVENT=2000` allows up to 2,000 photos in each gallery. Fifty is a conservative product ceiling rather than a Cloudflare Free quota; a deployer who needs more separate galleries can raise `MAX_EVENTS` in both production and preview configuration, then redeploy. The owner-facing setting still cannot exceed that reviewed deployment value.

The checked-in storage ceiling is 9.9 decimal GB, leaving room for the approximately 39 MB face models in a single otherwise-empty Cloudflare account. The checked-in total-face ceiling is 39,000 SFace vectors, or 4,992,000 stored dimensions at 128 dimensions per face. Both remain below their corresponding single-account free allowances when this is the only deployment using the account.

These settings do **not** reserve Cloudflare capacity, create billing alerts, or guarantee a free bill. Allowances are pooled across the Cloudflare account. Other deployments, buckets, databases, indexes, reads, writes, searches, and Worker requests consume the same pools. R2 operations, D1 rows, Worker requests, and queried Vectorize dimensions require provider analytics rather than a local persistent-data cap.

## Cost and reliability risks

- The Worker fails closed for missing required auth, secrets, or access classification. Provider quota exhaustion may therefore make a feature unavailable rather than silently public.
- R2 egress being free does not make storage or operations free. Downloads, imports, delete retries, and browser replays matter.
- D1 charges and limits use rows read/written, including scans and indexes, not merely returned rows.
- Vectorize billing is based on stored and queried vector dimensions. A top-K or fan-out decision can change usage materially.
- The repository has no billing-alert setup, usage-budget automation, Cloudflare Analytics export, or cost dashboard.

## Launch decision

Use free tier only after a representative import, gallery view, protected unlock, download, deletion, and—if enabled—face search are measured in the target Cloudflare account. Record the actual plan, usage dashboard date, application caps, and a paid-plan escalation decision. Do not promise unlimited galleries, unlimited storage, or free service in customer copy.
