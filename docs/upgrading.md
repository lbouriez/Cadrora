# Upgrading Cadrora

Cadrora has no tagged release process or automated application rollback. Its release scripts can apply remote D1 migrations by binding name, but an upgrade remains an operator-managed change: keep the previous deployed Worker version and resource mapping available through the Cloudflare account.

## Before upgrading

1. Read the target change set, `docs/technical/contracts.md`, and any new ADR before changing dependencies or contracts.
2. Confirm the exact production D1 database, media bucket, model bucket, hostname routes, secrets, and optional Vectorize index outside the repository.
3. Preserve a tested provider-account backup/restore point. This repository does not create one.
4. Validate the target revision:

   ```powershell
   npm ci
   npm run setup -- --diagnose
   npm run check
   npm run test
   npm run build
   ```

5. Exercise public `/`, `/galleries`, and `/contact`, a public gallery, protected unlock/media, admin authorization, language policy, and any enabled import/face-search path in an isolated environment.

## Database changes

Migrations are ordered under `migrations/`. `npm run setup` applies them only to local persisted D1 state. For the isolated preview or production target, use `npm run release:migrate -- --env preview --confirm` or `npm run release:migrate -- --production --confirm`; both invoke `wrangler d1 migrations apply DB --remote`. Do not deploy a schema-dependent Worker change until the remote migration plan has been reviewed, backed up, rehearsed in the isolated preview resource, and recorded by the operator.

Migrations are forward changes, not a substitute for restoring a backup. Avoid destructive SQL and do not reuse an existing migration filename.

Migrations `009_gallery_deletion.sql`, `010_site_languages.sql`, and `011_owner_quotas.sql` add deletion fencing/jobs, the enabled-language list, and nullable owner self-limits. Deploy them before code that reads `events.deleting_at`, `site_settings.enabled_languages`, or the `owner_*_limit` columns; the checked-in release script does this automatically. Existing sites start with both French and English enabled and use the deployment quota ceilings until an owner saves lower limits.

For showcase deployments created before contact details moved into D1, the opt-in demo seed only fills a never-edited `site_settings` row. A site whose map or other settings were already saved will not be silently overwritten. In **Admin → Site settings → Contact**, enter the desired public phone, email, address, and service area once; check `/api/v1/site` and `/contact` afterward. Real photographer deployments should enter their own values, not copy the showcase's fictional coordinates. Optional compiled `VITE_CONTACT_*`/`VITE_SERVICE_AREA` values remain outage fallbacks, not the D1 source of truth.

## Dependency changes

The stack is locked by `package-lock.json`. Use `npm ci` for reproducible validation. New or replacement dependencies require a same-change ADR under `docs/decisions/`, plus `npm run check`, `npm run test`, and `npm run build`. Do not use a package-manager `latest` result as production compatibility proof.

Pay special attention to Worker compatibility, browser WASM assets, Cloudflare binding types, and TypeScript strictness. The face model artifacts are separately pinned by checksum in `scripts/models/manifest.json`; a package upgrade does not authorize changing a model.

## Deploy and verify

After the target resources and remote migration are explicitly ready, the repository deployment command is:

```powershell
npm run deploy
```

It is the Deploy Button production entry point: it builds, applies the remote `DB` migration, and invokes Wrangler deploy. For a manually selected target, use `npm run release:deploy -- --production --confirm` or `npm run release:deploy -- --env preview --confirm`. A command alone does not prove correct hostname routing, secrets, model-object upload, scheduled maintenance, or database migration. Validate those outcomes after deployment and record the deployed version.

## Known upgrade gaps

- Preview is a named Wrangler environment with separate configured D1/R2 bindings and separately managed secrets; verify its generated resources before use.
- No CI/release approval, backup, or application rollback automation is checked in.
- `FACE_INDEX` is bound in the checked-in Wrangler configuration to the named production and preview Vectorize indexes. Before adopting this release, create those isolated indexes at 128 dimensions with cosine similarity and the `partition_id` string metadata index.

Resolve or consciously defer each item in a release record; do not silently treat it as solved by a successful build.
