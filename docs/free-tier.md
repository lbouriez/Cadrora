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

This is a **planning grid, not a bill forecast or load test**. It varies galleries, photos, and indexed faces separately. All data is assumed to exist for a full 30-day month; the face-search feature is on only in rows with faces, and no face records expire during that month. The figures exclude a domain, tax, other Cloudflare projects in the account, and optional third-party services.

### Assumptions behind every row

- **R2 Standard:** 2 MB *total across generated image variants per photo*, with **Keep original files off**, not 2 MB per object, plus 0.1 GB for private models/overhead. Storage is `photos × 0.002 + 0.1` GB-month. Billable storage is approximated as `ceil(max(0, GB-month − 10)) × $0.015`; Cloudflare rounds R2 usage to whole billing units. The 10 GB-month allowance applies to the whole account, not each bucket. Kept originals are additional storage: add their actual bytes per photo to the estimate. Real image sizes can be much larger.
- **D1:** To display a database-size estimate, assume **4 KiB/photo** for its record, variant records, and indexes; **0.5 KiB/indexed face** for its metadata/indexes; and **4 KiB/gallery**. These are *illustrative placeholders*, not measured Cadrora row sizes. Estimated MB is `(photos × 4096 + faces × 512 + galleries × 4096) / 1,000,000`. Free has a 500 MB **per-database hard limit**. Paid includes 5 GB **across the account**, then lists $0.75/GB-month; the single-database Paid limit is 10 GB. Every grid row is below the Paid storage allowance, so the D1 storage component is $0. D1 row-operation charges are also modelled as $0 only because usage is assumed below the relevant included limits, **not** because a photo generates a fixed number of reads or writes.
- **Vectorize:** Each indexed face is one 128-dimension vector. Free includes 5 million stored and 30 million queried dimensions; Paid includes 10 million stored and 50 million queried dimensions. The grid allows **10,000 billable vector queries per month** in rows with faces; these are provider queries, not necessarily 10,000 visitor searches, because Cadrora can fan out across partitions. Following Cloudflare's published pricing example, queried dimensions are modelled as `(stored vectors + billable queries) × 128`, with zero queried usage if no queries occur. Paid overages use $0.05/100 million stored dimensions and $0.01/million queried dimensions. A row above the Free stored limit assumes Workers Paid. Actual provider metrics override this illustration.
- **Traffic and imports:** Assume Worker requests/CPU, D1 row reads/writes, and R2 Class A/B operations remain within the respective plan's included amounts. Even the 100,000-photo row would write roughly 500,000 R2 objects if an import generated five variants/photo, below R2's 1 million included Class A operations, but other operations could change that. Keeping originals adds one more R2 object and upload operation per photo. Free plans also have *daily* Worker and D1 limits; a large same-day import can fail despite a small monthly estimate. All rows assume representative imports have completed and daily limits are respected.
- **Workers:** The grid chooses Workers Free where stored Vectorize dimensions fit Free and the assumed traffic respects its limits. R2 storage over 10 GB does **not** itself force Workers Paid, but still requires R2 billing and a higher Cadrora media ceiling. Workers Paid contributes its $5/month account minimum where shown; its included usage is 10 million dynamic requests and 30 million CPU milliseconds per month. Static assets served directly are not dynamic Worker requests.

### Comparative grid

Amounts are approximate **US$/month**. The D1 column includes estimated stored MB to distinguish a zero-dollar bill from a capacity guarantee; the R2 column includes GB-month. The Vectorize column is the *usage charge beyond its plan's included dimensions*, separate from the Workers subscription. Individual money columns are rounded for readability; the total is calculated from unrounded amounts.

| Pattern | Galleries × photos | Faces/photo → total | D1 size / cost | R2 size / cost | Vectorize cost | Workers | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First portfolio | 2 × 200 = 400 | 0 → 0 | ~2 MB / $0 | 0.9 GB / $0 | $0 | Free | **$0** |
| Many small galleries | 50 × 100 = 5,000 | 1 → 5,000 | ~23 MB / $0 | 10.1 GB / ~$0.02 | $0 | Free | **~$0.02** |
| Few larger galleries | 5 × 1,000 = 5,000 | 1 → 5,000 | ~23 MB / $0 | 10.1 GB / ~$0.02 | $0 | Free | **~$0.02** |
| Few galleries, many faces | 5 × 1,000 = 5,000 | 8 → 40,000 | ~41 MB / $0 | 10.1 GB / ~$0.02 | $0 on Paid | $5 Paid | **~$5.02** |
| Growing studio | 15 × 600 = 9,000 | 2 → 18,000 | ~46 MB / $0 | 18.1 GB / ~$0.14 | $0 | Free | **~$0.14** |
| Many photos, AI off | 20 × 1,500 = 30,000 | 0 → 0 | ~123 MB / $0 | 60.1 GB / ~$0.77 | $0 | Free | **~$0.77** |
| Established studio | 50 × 1,000 = 50,000 | 3 → 150,000 | ~282 MB / $0 | 100.1 GB / ~$1.37 | <$0.01 on Paid | $5 Paid | **~$6.37** |
| Large archive | 100 × 1,000 = 100,000 | 6 → 600,000 | ~717 MB / $0 on Paid | 200.1 GB / ~$2.87 | ~$0.31 on Paid | $5 Paid | **~$8.18** |

**Why does the gallery count look cheap?** The two 5,000-photo/5,000-face rows have the same R2 and Vectorize totals; their different gallery counts add only about 0.2 MB of modelled D1 metadata. Gallery count can still affect visitor traffic and product limits. **Why does a face-heavy row jump to $5?** Forty thousand 128-dimension vectors are 5.12 million stored dimensions, just over Vectorize Free's 5 million; the Paid plan includes enough dimensions that the *Vectorize usage* itself is $0 in that row.

For the requested **50 × 1,000 × 3** case: 50,000 photos, 150,000 faces, about 282 MB modelled D1 storage, 100.1 GB-month R2, and 19.2 million stored vector dimensions. R2 is `ceil(100.1 − 10) × $0.015 = $1.365`. Paid Vectorize storage overage is `(19.2m − 10m) × $0.05 / 100m = $0.0046`; with 10,000 provider queries, modelled queried dimensions are 20.48m, under Paid's included 50m. So `$5 Workers + $0 D1 + $1.365 R2 + $0.0046 Vectorize ≈ $6.37`. This says nothing about whether a real 50,000-photo import performs well.

The **large archive** deliberately makes Vectorize usage visible: 600,000 faces produce 76.8m stored dimensions ($0.0334 overage) and, with 10,000 provider queries, 78.08m queried dimensions ($0.2808 overage), or ~$0.31 combined. R2 contributes `$2.865`; D1's modelled 717 MB exceeds the Free 500 MB database limit but is within Paid's included 5 GB. The approximate total is `$5 + $2.865 + $0.3142 = $8.1792`, displayed as ~$8.18. Real face-search fan-out, D1 size, and traffic can be quite different.

**Capacity warning:** Cadrora ships with 50 galleries maximum, 2,000 photos/gallery, 9.9 GB media, 10,000 faces/gallery, and 39,000 faces overall. Any row above 9.9 GB media requires a reviewed `MAX_STORAGE_BYTES` change in production and preview `wrangler.jsonc`; rows above 39,000 faces also need `MAX_TOTAL_FACES` raised and Workers Paid. The large archive additionally needs `MAX_EVENTS` raised. Each gallery in the face-heavy rows remains under the default 10,000-face *per-gallery* cap. None of the high-volume rows is a validated performance target. Measure actual D1 size against the Free 500 MB or Paid 10 GB per-database limit before importing; the admin UI cannot override a lower deployment ceiling.

If a real D1 database grows beyond the Paid plan's included **5 GB account-wide**, its published storage overage is **$0.75 per additional GB-month** (for example, approximately $0.75 for 6 GB stored all month in an otherwise empty account). D1 row operations can add more even when storage remains included: Workers Paid includes 25 billion rows read and 50 million rows written per month, then lists $0.001/million reads and $1/million writes. A hypothetical 60 million rows written in a month would add about **$10** in D1 write charges, even if the database occupied less than 5 GB. These counts cannot be inferred from photo count alone; use D1 Row Metrics. Cloudflare's actual invoice rounding may vary. Refer to [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/), and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) before quoting a customer.

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
