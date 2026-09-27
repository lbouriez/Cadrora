# ADR-031: Restore the complete built-in service example

Status: accepted by the owner's 2026-09-27 request. This extends ADR-028 and aligns the Services editor with the Home introduction reset in ADR-029.

## Context

The Home introduction's **Restore example** action resets its copy and photo. A built-in service offered **Restore default text**, which cleared only its copy override and left an uploaded photo in place.

## Decision

- Both admin editors use the same translated **Restore example** label and restore their complete example copy and photo. Custom services have no compiled example and offer no reset.
- Add an owner-only `POST /api/v1/admin/services/:id/reset` route for built-in service IDs. It clears the D1 copy override and all published or pending image variant rows in one D1 batch, queues existing retryable media cleanup jobs, and returns the validated service card.
- Preserve the service's order, Services-page visibility, and Home eligibility. Retain the highest image revision as an internal counter so a later upload receives a fresh versioned URL. The public card reports no active image revision when no published variant row exists and uses the compiled profile photo.

## Consequences

The reset does not require an R2 deletion to succeed immediately. Versioned media routes stop authorizing the removed variant rows, and the maintenance job removes their objects after its safety delay. The public HTML routes remain static.
