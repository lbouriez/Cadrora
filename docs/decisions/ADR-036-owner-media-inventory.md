# ADR-036: Owner media inventory

Status: accepted on 2026-09-27.

## Context

D1 is the reference for deletion jobs, yet an R2 upload can complete before its D1 variant write. A failure at that boundary may leave an object without a D1 row. D1 usage totals and maintenance-job status alone cannot find it. Operators need a bounded way to inspect this state before production without granting the browser direct R2 access.

## Decision

Add an owner-only diagnostics view and API that list at most 100 R2 objects per request in each of the gallery, service, and portfolio namespaces. Compare objects older than 15 minutes with the corresponding D1 variant table. Return only untracked keys, upload time, a continuation cursor, and deletion-job state counts. The UI requires a deliberate scope selection and manual continuation. The API is read-only; no R2 object is deleted without a D1-derived cleanup record. Read-only demo users cannot access it.

This extends the existing diagnostics page, which remains linked only from the owner admin navigation. The inventory does not establish that D1-recorded objects still exist in R2 or that Vectorize has no orphan records. Those checks remain separate release and operator checks.

## Consequences

Each scan incurs one R2 list and bounded D1 lookups; it must not run on every admin page load. Results can be temporarily inconsistent with concurrent uploads and maintenance. Operators review findings against jobs and D1 state before any repair.
