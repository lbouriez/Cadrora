# ADR-006: Isolated instances and owner self-quotas

Status: accepted, 2026-09-22.

## Context

Cadrora is primarily a source-available product that a photographer forks, customizes, and deploys to a domain in their own Cloudflare account under the repository license. A small number of trials may instead use an exact subdomain such as `alice.cadrora.com`. Turning the main Worker into a multi-tenant application or building an operator control plane now would add tenant filters, fleet credentials, lifecycle state, aggregate accounting, and failure recovery before those needs are proven.

Cloudflare Free allowances are account-level pools. A bucket, database, index, or Worker does not receive a fresh allowance. Some persistent quantities can be bounded before a write, while daily Worker requests, R2 operations, D1 row operations, and queried vector dimensions require provider usage data.

## Decision

- Keep the Cadrora runtime single-tenant.
- Treat a root domain and a subdomain identically: each instance receives a separate Worker, D1 database, private media bucket, private model bucket, Vectorize index, secrets, and exact Custom Domain.
- Retain the existing `npm run deploy` path for the primary deployment. Add a separate, explicit `npm run deploy:instance` provisioner whose deterministic names make the same instance command safely repeatable without rebinding the primary deployment.
- Keep customer presentation in that customer's fork/build. Do not add a page builder or runtime tenant theming.
- Add owner self-limits for gallery count, stored media bytes, and total stored faces. The server enforces the lower of the owner limit and deployment/system ceilings at the write boundary.
- Reserve approximately 100 MB of R2 Free storage for pinned face models and overhead by setting media to 9.9 decimal GB. Cap faces at 39,000, which uses 4,992,000 of the 5,000,000 Free stored vector dimensions at 128 dimensions per face.
- Do not claim that these controls guarantee zero cost. Other resources and other instances in the same account consume the same pools.
- Defer the optional admin-of-admins control plane to [`../future-operator-control-plane.md`](../future-operator-control-plane.md).

## Consequences

Isolation preserves the current authorization model and makes a customer's data boundary easy to understand. It also consumes one D1 database per instance, so a Free account reaches Cloudflare's ten-database resource limit quickly. Model files are duplicated by design; this is simpler and independently removable but consumes pooled R2 storage.

Lowering an owner limit never destroys existing data. New writes remain blocked until usage falls below the selected limit. Quota reads add small indexed/count queries and cannot provide an atomic account-wide reservation across concurrent Worker requests.

The manual provisioner is not a fleet manager. It does not delete instances, aggregate usage, schedule upgrades, or reconcile partially removed resources. Those capabilities require the separately authenticated and auditable control plane described in the deferred design.
