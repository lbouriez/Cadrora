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

Migration `013_original_media.sql` snapshots original-file retention per import and rebuilds the `photo_variants` table to permit unchanged PNG originals. Rehearse it against a backed-up preview D1 database before production; it copies existing variant rows and does not create originals for past imports. After upgrading, verify one new original-enabled import, one generated-copy fallback, cover selection, and original/download denial when the respective gallery settings are off. Retained originals increase R2 storage and may contain source metadata.

Migration `014_original_cleanup.sql` adds a durable `delete_gallery_originals` maintenance kind without removing existing jobs. After upgrade, disable original delivery on a test gallery, confirm the admin warning reports its remaining originals, queue cleanup, wait at least five minutes and run scheduled maintenance, then verify only its `original` R2 objects and D1 variant rows disappear. Generated downloads must continue working. Do not deploy this Worker before both migrations have been applied to the target D1 database.

Migration `015_private_gallery_favorites.sql` adds the shared `photos.liked` flag, defaulting existing photos to false. Apply it before the Worker that lists or updates private-gallery hearts. After upgrade, unlock a protected gallery, mark a photo in the mosaic, confirm the viewer and a second authorized browser see the same state, clear it, and verify a public gallery shows no heart or writable favorite route.

Migration `016_favorite_photo_replacement.sql` adds the independent private-gallery retouch-selection flag, replacement import tracking, and retryable old-media cleanup kind. Apply it before deploying the new Worker. Existing hearts stay unchanged; all existing photos start with no retouch request. After upgrade, check that a private gallery heart and check mark can be changed separately, the admin **Client photo choices** screen shows separate **To retouch** and **Favorites** lists, and a read-only demo cannot download or replace. Rehearse replacing a selected photo with an edited version of the same image: its link and choices must remain, the owner download must return the new best-quality file, and the old R2 keys should disappear after maintenance. Replacements keep existing face-search references, so do not substitute a different subject without planning re-indexing.

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
