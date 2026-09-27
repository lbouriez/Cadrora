# ADR-035: Bound anonymous sensitive requests before provider work

Status: accepted on 2026-09-27.

## Context

The existing 120-per-minute request limiter and five-failed-login limiter hold counters in a Worker isolate. They remain useful local safeguards, but their state does not coordinate across isolates or hostnames. Turnstile validates login and gallery unlock proofs, while anonymous face search can invoke Vectorize repeatedly. A flood of invalid proofs can also consume Siteverify requests before route-level validation starts.

## Decision

- Add Cloudflare Workers Rate Limiting bindings for authentication attempts (20 per 60 seconds) and face-search requests (30 per 60 seconds). Production and preview use separate namespaces. The key scopes a client IP, operation, and hostname so unrelated isolated photographer sites do not share counters. Anonymous requests have no durable user identity; thresholds leave room for visitors behind a shared network.
- Run the binding check after request identity and auth context, before Turnstile and route handlers. A missing or failing binding rejects only these sensitive POST requests with a safe 503; exhaustion returns JSON 429 with `Retry-After: 60`. No IP, proof, gallery ID, password, or biometric data is logged by this middleware.
- Retain the existing isolate-local general and failed-login limits as secondary safeguards. Keep public marketing pages, gallery browsing, media, and upload requests outside the new binding checks so legitimate photo viewing and active imports are unaffected.
- On a Cloudflare zone where available, add one conservative WAF rate rule for the same sensitive URL families to stop obvious floods before Worker invocation. Zone rules do not replace the Worker binding on `workers.dev` or preview hostnames.

## Consequences

Workers Rate Limiting counters are local to a Cloudflare location and eventually consistent, so these limits are abuse controls rather than exact quotas. Shared public IPs may still cause occasional 429 responses; review 429 rates before tightening thresholds. Deploying this revision requires both bindings on each Worker environment. Preserve the fail-closed response if binding configuration is incomplete.
