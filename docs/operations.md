# Operations runbook

Use this runbook for a deployed Cadrora Worker. It is intentionally conservative: the repository contains no production telemetry, alert configuration, or maintenance-job dashboard. Remote D1 migrations are available only through the explicit release scripts; do not turn an uncertain provider operation into a claimed success.

## Before changing production

1. Record the target hostname, Worker version, intended D1/R2 resources, and change owner in the protected operator record.
2. Run `npm run check`, `npm run test`, and `npm run build` from the exact source revision. Rehearse a schema change with `npm run release:migrate -- --env preview --confirm` before its production release.
3. Confirm `/` and `/contact` remain public static routes and do not depend on login or the gallery API.
4. Verify custom hostname, preview hostname, and `workers.dev` behavior separately for admin and protected media.
5. Never put secrets, cookies, raw embeddings, selfies, private EXIF, or event passwords into change notes.

## Routine checks

| Area | What to verify | Current evidence boundary |
| --- | --- | --- |
| Public site | `/`, `/galleries`, and `/contact` render with public build-time content or a clear unconfigured state | Covered locally by Playwright; still verify the deployed hostname. |
| API routing | An unknown `/api/*` path returns JSON with request ID, not index HTML | `app.notFound` implements this. |
| Admin | `/admin` remains protected on every hostname; state-changing admin calls reject a mismatched/missing Origin | The SPA mounts login, dashboard, and import routes; verify live behavior on every hostname. |
| Gallery | Draft is 404; protected metadata/media reject missing or stale grants | Test the exact deployed event/version. |
| Cache | Admin `no-store`; unknown/protected content private; public revisioned media immutable | Inspect actual response headers. |
| Models | Only the two allowlisted `/models/v1/...` paths return immutable objects | Model objects and Vectorize binding need independent deployment confirmation. |

## Maintenance jobs

Photo deletion, gallery deletion, and face purge write a `maintenance_jobs` record after D1 access changes. A lost face-index lease also writes a targeted `delete_face_vector` compensation job when its immediate provider rollback fails. `MaintenanceRunner` defaults to up to 10 jobs per direct invocation and retries provider failures with exponential delay up to one hour. Ordinary jobs are retained as `failed` on the fifth failure for operator attention; `delete_gallery` remains pending and inaccessible while it retries, so gallery-owned provider data is not silently stranded. A `running` job has a 15-minute lease based on `updated_at`; a later scheduled invocation may reclaim it after an isolate termination. Provider deletes and completion writes must therefore remain idempotent.

The checked-in Worker has a Cron Trigger every 15 minutes. Its scheduled handler calls `enqueueExpiredFacePurges` and then `runMaintenance(bindings, 25)`. That is the intended cleanup path, but it is not a job dashboard or proof a deployed Cron Trigger is active. Confirm trigger delivery and job completion before promising R2/Vectorize cleanup, storage reclamation, or final physical deletion.

Inspect the queue only with approved, least-privilege D1 access. Preserve job ID, state, attempts, and request IDs; do not hand-edit rows or delete media keys as an unrecorded workaround. A repaired runner must be tested against an isolated environment before retrying production jobs.

### Gallery removal verification

1. Confirm the gallery stopped responding publicly immediately after title confirmation.
2. Wait at least for the five-minute quiescence window and one 15-minute Cron cycle.
3. With approved D1 access, verify the `delete_gallery` job reached `completed` and the gallery row no longer exists.
4. Do not infer R2 or Vectorize cleanup from the missing public page alone. Investigate provider errors through the job's safe `last_error` value without copying private object keys or vectors into tickets.
5. Never remove the shared `MODELS_BUCKET` objects as part of gallery cleanup.

## Incident handling

### Protected content appears accessible

Treat as a security incident. Capture only URL, timestamp, hostname, response status/headers, and request ID. Do not download or redistribute the asset. Check whether the event is public, whether its revision/access version changed, and whether the route was reached through an unexpected hostname. Disable public exposure through the authenticated event path when available, then follow [`SECURITY.md`](../SECURITY.md).

### Admin sign-in or protected-gallery unlock fails

Check the configured auth mode, presence of required secret/bindings, correct Turnstile hostname configuration, and `Origin` behavior. Password mode requires a matching versioned `ADMIN_SECRET_HASH` and `AUTH_PEPPER`; protected-event credentials use the same pepper under a separate HMAC domain. Cloudflare Access mode requires a valid assertion, issuer, and audience. Record only the request ID and safe API code: `TURNSTILE_FAILED` means a challenge was rejected, `TURNSTILE_UNAVAILABLE` means verification could not be performed, and `EVENT_PASSWORD_UNAVAILABLE` or `EVENT_GRANT_UNAVAILABLE` means the Worker failed closed around event credential/grant handling. Do not share a password, pepper, Turnstile token/secret, stored verifier, or session cookie.

### Import fails or stops

Preserve the browser journal and import ID. Check application limits, browser decode/encoding support, checksum/MIME metadata, and network availability. Reuse the same IDs and chunk order for a supported retry. Do not create arbitrary duplicate photo IDs.

### Face search unavailable

Leave galleries available. Check feature binding/configuration, model-object integrity, cursor-signing material, event enablement/expiry, and real browser support. Never request a visitor’s selfie for remote debugging.

## Backup, restore, and rollback status

The repository provides neither a remote backup schedule nor a restore/rollback procedure. It also provides no versioned release workflow. Before production use, establish provider-account backup, retention, tested restore, deploy rollback, and change-approval procedures. Do not represent local `npm run setup` as a remote backup or migration rollback.
