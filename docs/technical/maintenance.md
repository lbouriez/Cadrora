# Maintenance workspace

The owner reaches `/admin/maintenance` from the shared admin navigation. All profiles use the same workspace and FR/EN resources. Read-only demo sessions have no navigation item and are denied by the Worker before D1/R2 reads. The old diagnostics URL redirects to the logs section. See [ADR-053](../decisions/ADR-053-owner-maintenance-and-application-log.md).

## Extension points

- `src/app/admin/maintenance/MaintenancePage.tsx` registers section IDs and components. Query-string section links support back/forward navigation and normal keyboard navigation. Only the selected component mounts; add future sections here with a dedicated component/API module and bilingual resource keys.
- `src/shared/schemas/maintenance.ts` defines validated inputs/outputs, the operation kinds, log levels/sources and the 90-day history policy. No generic arbitrary-metadata bag is accepted.
- `src/server/services/appLog.ts` is the single structured event sink. Call it with safe event codes and references. Add a new source to the shared enum deliberately; never pass an exception or spread a request into the logger. Persisting is best effort and emits the same safe event to console for provider-side diagnosis when D1 is unavailable.
- `src/server/services/maintenanceStatus.ts` reads bounded job pages and overview aggregates. Existing job payloads remain private. The UI shows generic next-step advice rather than raw provider failures.
- `src/server/maintenance/observeRun.ts` records invocation-level evidence independently of the existing retryable maintenance runner. `app.ts` runs retention alongside normal maintenance through the existing Cron trigger, waits for both tasks, then records completion/failure.

## Evidence and retention

A completed run means the scheduled invocation finished, not that every claimed job succeeded. Inspect failed jobs and retry times separately. A running job's expired 15-minute lease can be reclaimed by a future invocation. The overview warns when no success has been recorded in the last 30 minutes; this is an observation threshold, not a claim about Cloudflare's cause or availability.

Logs and run history are retained for 90 days; physical purge processes at most 1,000 expired rows from each table per invocation. The scheduler must be active and D1 writable for cleanup to progress. Completed jobs are not log rows and remain durable. The compatibility HTTP-error endpoint uses the same 90-day cutoff but only returns HTTP errors. Existing data removed under the former policy is gone.

The initial instrumentation covers classified HTTP 5xx errors, job failures and scheduled-run outcomes. It does not collect browser console output, every successful upload/request, or logs from third-party services. Additional instrumentation should record meaningful operation outcomes, not per-photo noisy telemetry. Media checks reuse the read-only 100-object inventory and run only after an owner chooses a scope; no empty result proves all media or vectors are healthy.

## Validation

`tests/unit/server/maintenanceObservability.test.ts` runs real SQLite migrations and SQL to check persistence, privacy boundaries, pagination, authorization, history cleanup and scheduler evidence. The existing runner/error/media tests retain their operational coverage. `tests/e2e/maintenance-site-profile.spec.ts` covers FR/EN desktop/mobile sections, keyboard links, filters, deliberate scans, unavailable data and demo denial using mocked HTTP responses. Live Cron, provider failures and deployed hostname access require a separate release check.
