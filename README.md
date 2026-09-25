# Cadrora

Your photography website and galleries, on your own Cloudflare account.

Cadrora is a starting point for an independent photographer: a public website for your work and services, a contact page, and galleries you can share publicly or protect with a password. Visitors can browse and download photos when you allow it. Optional face search helps them find possible photos of themselves **within one gallery**; their selfie stays in their browser. [Explore the live showcase](https://cadrora.com/).

You own the deployment and the content. The showcase is a demonstration, not a hosted Cadrora service that you must subscribe to. Replace its sample text and photographs with your studio's identity.

## License

Cadrora is available under the [PolyForm Perimeter License 1.0.1](LICENSE.md). You may fork and customize it to run your own photography website and galleries, including for your photography business. The license does not permit providing others with a product or service that competes with Cadrora, such as a hosted gallery platform. The license text governs these permissions and restrictions. Third-party packages and face models retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

## What you get

- A responsive website with home, services, galleries, contact, and privacy pages.
- Public, unlisted, or password-protected galleries; optional downloads of untouched originals (or the best prepared copy) and gallery-scoped face search. In a private gallery, guests can mark favorites separately from photos they want retouched; the photographer can download the selection and return edited versions. Originals are an optional delivery format, not a photographer's backup: they can be removed from a gallery without removing its prepared photos.
- Published galleries can appear on the home and Galleries pages, newest by creation date first. You can hide any gallery from those lists while keeping its direct link active. Listed password-protected galleries show their title, date, and description, while the password protects their photos. Inside a gallery, photos load progressively as visitors scroll.
- An admin area for publishing galleries and editing the site's languages, appearance, services, contact details, and optional analytics.
- No required contact-form provider, tracker, or external image host. Google Analytics is optional and loads only after visitor consent.

For the product's data flow and privacy boundaries, see [how Cadrora works](docs/architecture.md) and the [privacy guide](docs/privacy.md).

## Deploy it to your Cloudflare account

You will need a Cloudflare account, a GitHub repository containing your fork, Node.js 22.12+ and npm 10+, and a domain or subdomain in a zone you control. Cloudflare provides the website runtime and three storage services: **D1** holds gallery/settings records, **R2** holds private photo files, and **Vectorize** indexes faces only for galleries where you enable the finder. You do not need to buy another application server.

The short path is:

1. Fork this repository, enable R2 in your Cloudflare account, and create the D1 database, private R2 buckets, and Vectorize index described in the [deployment checklist](docs/deployment.md#existing-repository-cloudflare-builds).
2. Generate your admin credentials locally, connect **your existing fork** through Cloudflare Workers Builds, and enter the build variables and encrypted secrets using the [exact field map](docs/deployment.md#cloudflare-setup-form-exact-field-map). This route does **not** create a second GitHub repository.
3. Deploy, verify the Worker hostname, attach your domain, then fill in your studio's real details under **Admin → Site settings**. The [deployment guide](docs/deployment.md#deployment-and-release-checks) lists the checks to perform before sharing the site.

The [full deployment guide](docs/deployment.md) covers every manual Cloudflare action, root domains versus subdomains, Turnstile keys, the optional showcase, and upgrades. A one-click [Deploy to Cloudflare clone](docs/deployment.md#deploy-button-setup-page) is also possible if you deliberately want Cloudflare to create a separate repository; it is not the existing-fork path. [Admin guide](docs/admin-guide.md) explains daily use.

This repository also contains an optional [Atelier Giulia site profile and isolated GitHub pipeline](docs/deployment.md#atelier-giulia-from-this-repository). It demonstrates how one shared codebase can publish two separately branded sites into different Cloudflare accounts without a fork. It does not activate or alter the normal Cadrora deployment for other users.

For a local preview, after cloning your fork:

```powershell
npm ci
npm run setup:local
npm run dev
```

`setup:local` creates ignored local credentials and test-only Turnstile keys. Keep the generated password safe and never deploy those test keys. See [local validation](docs/deployment.md#local-validation) for existing installations and manual setup.

## What will Cloudflare cost?

The software has no licence fee. Cloudflare has free allowances, but they are **shared by your whole Cloudflare account**, not renewed for every bucket, gallery, or Worker. A domain name, taxes, optional third-party services, and any usage above allowances are separate. Workers Paid starts at **US$5/month per account**; R2 storage and operations can incur usage charges independently. R2 activation may require an account-level billing setup even if you expect to remain within its free allowance. A small site may stay within free usage, but the free plan has hard daily/runtime limits, not an unlimited guarantee. Check your Cloudflare dashboard before promising a customer a price.

At a glance, the current Free allowances are **100,000 Worker requests/day** (and 10 ms CPU per invocation), **10 GB-month of R2 Standard storage** plus 1 million writes and 10 million reads/month, **5 million D1 rows read/day and 100,000 written/day** (with a 500 MB limit per database), and **5 million stored / 30 million queried Vectorize dimensions**. These are different meters: 100,000 photo views are not necessarily 100,000 D1 rows, and a photo with several image variants consumes more than one stored object. See the [detailed limits](docs/free-tier.md#relevant-cloudflare-allowances).

Here is a **comparison grid, not a quote or load test**. Each photo is assumed to occupy **2 MB across all generated image variants, with original-file retention off**, plus 0.1 GB for models/overhead; the gallery and face columns are deliberately varied independently. Amounts are **US$/month**. D1 figures use a rough metadata-size model, not a measured database. All rows assume modest traffic and operations within the relevant plan's included amounts.

| Pattern | Galleries × photos | Faces/photo | D1 database | R2 files | Vectorize faces | Workers | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First portfolio | 2 × 200 | 0 | $0 | $0 | $0 | Free | **$0** |
| Many small galleries | 50 × 100 | 1 | $0 | ~$0.02 | $0 | Free | **~$0.02** |
| Few larger galleries | 5 × 1,000 | 1 | $0 | ~$0.02 | $0 | Free | **~$0.02** |
| Few galleries, many faces | 5 × 1,000 | 8 | $0 | ~$0.02 | $0 | $5 Paid | **~$5.02** |
| Many photos, AI off | 20 × 1,500 | 0 | $0 | ~$0.77 | $0 | Free | **~$0.77** |
| Growing studio | 15 × 600 | 2 | $0 | ~$0.14 | $0 | Free | **~$0.14** |
| Established studio | 50 × 1,000 | 3 | $0 | ~$1.37 | <$0.01 | $5 Paid | **~$6.37** |
| Large archive | 100 × 1,000 | 6 | $0 | ~$2.87 | ~$0.31 | $5 Paid | **~$8.18** |

The two 5,000-photo rows with one face/photo show that **the number of galleries alone barely changes these costs**. Eight faces/photo instead crosses Vectorize's Free stored-dimension limit and calls for Workers Paid. The **50 × 1,000 × 3** row is your example: 50,000 photos and 150,000 indexed faces. The larger archive illustrates non-zero Vectorize usage; neither row is a validated Cadrora capacity target. D1 can show **$0 in every row** because its Paid plan includes 5 GB of storage, but the Free plan still has a **500 MB hard limit per database**. The [full matrix](docs/free-tier.md#monthly-price-examples) shows estimated D1/R2 size, vector dimensions, formulas, and other charges that could change the bill.

Most rows **exceed Cadrora's checked-in 9.9 GB media ceiling**; the established and large-archive rows also exceed its 39,000-face ceiling, and the large archive exceeds its 50-gallery ceiling. Those are deliberate deployment safeguards, not Cloudflare prices. Raise them explicitly before testing a larger installation. The table does not prove that a large import fits D1 limits or meets performance needs.

Removing an old gallery deletes its owned photos and face vectors after background cleanup, so future storage costs can fall. It does not refund storage already used earlier in a billing month, and it cannot prevent charges from traffic or other projects in the same Cloudflare account. You can also keep a gallery offline without deleting it, but **offline still uses storage**.

See [Cloudflare free limits, assumptions, calculations, and sensitivity examples](docs/free-tier.md) before choosing a plan. The source prices are linked there, including [R2](https://developers.cloudflare.com/r2/pricing/), [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), and [Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/).

## Find the right guide

| If you want to… | Read… |
| --- | --- |
| Deploy or upgrade your own site | [Deployment guide](docs/deployment.md) and [upgrading](docs/upgrading.md) |
| Understand costs and safe limits | [Free-tier and cost planning](docs/free-tier.md) |
| Run galleries and customise settings | [Admin guide](docs/admin-guide.md) |
| Understand face search and privacy | [Face search](docs/face-search.md) and [privacy](docs/privacy.md) |
| Develop or review the code | [Contributor guide](CONTRIBUTING.md), [technical documentation](docs/technical/README.md), and [agent rules](AGENTS.md) |

Contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md).
