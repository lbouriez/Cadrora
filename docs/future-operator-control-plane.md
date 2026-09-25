# Deferred operator control plane

Status: design note only; intentionally not implemented. Last reviewed: 2026-09-22.

## Decision

Cadrora remains a single-photographer, single-deployment source-available product. A photographer normally forks the repository under its license, changes the public frontend, and deploys it into their own Cloudflare account and primary domain.

A future optional operator project may live in this repository and deploy separately at a hostname such as `admin.example.com` or `ops.example.com`. The normal Cadrora build and Deploy button must not deploy it. Providing its explicit Cloudflare bindings, credentials, and deployment command would opt an operator into running a small hosted fleet.

This is a control plane around unchanged Cadrora instances, not a multi-tenant rewrite of the Cadrora Worker.

```text
operator admin
  -> durable provisioning workflow
     -> isolated Cadrora Worker + D1 + R2 + Vectorize + exact hostname

customer admin
  -> manages only that Cadrora instance and its galleries
```

## Intended capabilities

- Provision a customer from the operator UI: Worker, D1, private media/model R2, optional Vectorize, secrets, migrations, exact Custom Domain, DNS/TLS, and health check.
- Record lifecycle state and exact deployed Cadrora version.
- Suspend, resume, upgrade, and permanently remove a customer.
- Define operator quota ceilings and trial expiry.
- Show aggregate and per-instance usage without granting routine access to private galleries or photos.
- Keep an append-only audit record for every privileged operation.

Cloudflare's REST APIs cover D1, R2, Vectorize, Worker modules/assets, secrets, and Worker Custom Domains. Custom Domain attachment creates the required DNS record and TLS certificate. A durable workflow is still required because provisioning is multi-step and can partially succeed.

## Repository boundary

A possible layout is:

```text
operator/
  package.json
  wrangler.jsonc
  src/admin/
  src/api/
  src/workflows/
packages/platform-contracts/
```

The root `npm run deploy` continues to deploy only Cadrora. The operator project would require a separate explicit command. Its API token never enters the Cadrora Worker, a customer Worker, browser JavaScript, repository variables prefixed with `VITE_`, or deployment logs.

## Isolation and limited sharing

Each hosted customer keeps a separate Worker, D1 database, private media bucket, Vectorize index, secrets, sessions, and usage counters. This preserves the current security model, makes deletion auditable, and prevents a missing tenant filter from crossing customer boundaries.

Only immutable code releases, checksum-pinned AI models, the deployment engine, and possibly a root-domain Turnstile widget are candidates for sharing. Do not share customer media or face indexes.

The domain type is deployment metadata. `alice.example.com` and `photographer.example` use the same Cadrora artifact and behavior; each exact hostname is attached to its own Worker. Customer-specific public-site changes are expected to come from that customer's fork/build rather than a general-purpose page builder.

## Provisioning workflow

The UI creates a durable job with idempotent states:

```text
requested -> resources_created -> migrated -> worker_deployed
          -> secrets_installed -> domain_attached -> healthy -> active
```

The deployer uses a prebuilt, immutable Cadrora release. It must not run an unconstrained source build from browser input. A release records its Git commit, assets, migrations, binding contract, and compatibility version.

Before an operator UI is built, prove the exact lifecycle with a disposable smoke instance: provision `smoke-<id>.example.com`, exercise login/gallery/media/face search, delete every resource, and verify no residue. The current `npm run deploy:instance` command is the intentionally small precursor to this workflow.

## Deletion workflow

1. Mark the instance suspended and revoke sessions.
2. Optionally retain it for a documented recovery window.
3. Remove gallery media and face vectors with retryable cleanup.
4. Empty and delete customer R2 buckets.
5. Delete Vectorize and D1.
6. Detach the Custom Domain and delete the Worker.
7. Retain only a non-sensitive audit record.

Deletion requires typed confirmation of the exact customer identifier. Failures remain visible and resumable; a partial deletion is never reported as complete.

## Quota precedence

Quota enforcement belongs in the Cadrora core because only the data-plane Worker can reject a gallery creation, media write, or face upsert before it reaches Cloudflare. The future operator supplies an additional ceiling; it does not replace core checks.

```text
effective numeric limit = minimum(system safety, operator ceiling, owner self-limit)
effective feature       = supported AND operator-allowed AND owner-enabled
```

An operator increase does not silently erase a lower owner self-limit. Clearing an owner limit is a separate audited action. Lowering a limit below current usage never deletes data; it blocks new writes until usage returns below the limit.

For standalone deployments, no operator ceiling exists. The owner self-limits added to Site settings are bounded by deployment safety ceilings.

## Security boundary

The browser-facing operator UI does not hold the Cloudflare token. A dedicated provisioner/Workflow owns a narrowly scoped account token and receives authenticated jobs from the control-plane API. Protect the operator application with Cloudflare Access, verify Access assertions at the Worker, require confirmation for destructive operations, and audit actor, intent, target, release, result, and request ID.

The token remains powerful even when scoped: D1, R2, Vectorize, Workers Scripts, Workers Routes/Custom Domains, and zone access can affect the whole hosted fleet. Compromise of the operator is therefore a fleet-level incident.

## Account limits and cost

Cloudflare allowances are pooled per account, not multiplied per Worker, database, bucket, or index. Per-instance quotas protect against one instance consuming the whole pool but cannot guarantee that the combined account remains free. The future operator must also track aggregate usage and alert before account limits.

D1 Free currently allows only ten databases per account, making it the first likely resource-count limit for isolated trials. Moving to a paid Workers plan is preferable to weakening isolation with a shared tenant database.

## Explicit non-goals

- No multi-tenant D1 schema or tenant-prefixed media/index queries.
- No website builder or arbitrary HTML/CSS/script customization.
- No automatic deployment of the operator with a normal Cadrora installation.
- No operator access to customer photos by default.
- No claim that application self-limits guarantee a zero Cloudflare bill.

Revisit this design only after repeated isolated-instance provisioning is proven and manual fleet operation becomes a real burden.
