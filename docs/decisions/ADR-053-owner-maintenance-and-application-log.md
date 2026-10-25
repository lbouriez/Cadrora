# ADR-053: Owner maintenance and structured application history

Status: accepted through the owner's 2026-10-25 request for a generic Maintenance tab, persisted application logs and approximately 90-day cleanup.

## Decision

- Add an owner-only `/admin/maintenance` workspace with independently mounted Overview, Background jobs, Application logs and Media checks sections. Keep `/admin/diagnostics` as a client redirect to its logs section. Keep the existing diagnostics API and HTTP-error response contract.
- Use a small typed, shared `recordAppLog` boundary built on the existing D1 error history, with validated severity, source, event code, route family and request/job references. Do not add Winston or another dependency for this narrow Worker use case. Future sources extend the shared schema and their own instrumentation; adding a panel does not make it poll or scan automatically.
- Migration 046 extends the internal `worker_errors` table without losing existing rows. The legacy table name is retained for migration compatibility. The old endpoint continues to return only HTTP errors; the new endpoint supports severity/source filters and keyset pagination of at most 50 events.
- Persist classified HTTP 5xx failures, maintenance-operation failures and scheduled-run outcomes. Also emit the same structured event to the Worker console. Do not capture every request or arbitrary console output. No raw exception messages, request bodies, headers, URLs, selfies, vectors or photo data enter the new log API. New maintenance failures store a classified code rather than provider exception text; old job errors are never exposed by the jobs API.
- Keep application-log and scheduler-run history for 90 days. Queries exclude expired logs immediately. The existing 15-minute Cron deletes at most 1,000 expired rows per history table per invocation. An outage/backlog can delay physical deletion; the UI says so. Never age-delete maintenance jobs, whose durable/idempotency records have different semantics. Previously purged 30-day history cannot be recovered.
- Record each scheduled invocation separately: start, finish, outcome and number of job attempts processed. Wait for both cleanup and retention work to settle before recording the outcome. Telemetry failure must not stop maintenance or replace the original request error. D1 outages can prevent recording, so missing/stale observations are unknown, not healthy.
- Show job state, type, attempts, timestamps, expired leases, safe references and an existing gallery-settings link when the gallery still exists. Default to unfinished jobs. Do not expose payload JSON, storage keys or raw `last_error` in this API. The existing deliberate media inventory still exposes its owner-only findings.
- This is an observability addition, not a new repair engine. Keep upload resume, recovery from exact originals and replacement completion in their current screens. No arbitrary retry/delete button, background R2 scan, external log service, billing probe or automatic alert is introduced.

## Validation and release

Validate migrations and real SQL, owner/demo/anonymous access, filters and pagination, 90-day bounded retention, safe log fields, unavailable telemetry storage, separate run outcomes, FR/EN mobile/keyboard navigation, and lazy scans. Run check/test/build for both profiles. Production requires migration 046 and a Worker deployment; confirm a real Cron execution independently before claiming live maintenance health or retention.
