# ADR-019: Photo count in the admin gallery list

Status: accepted by the owner request on 2026-09-25.

## Context

The admin gallery list shows D1-recorded storage for each gallery but not how many photos it contains. The publication summary already defines a total for photos that are not in `deleting` or `deleted` state.

## Decision

- Add a required, nonnegative `photoCount` to each item in the authenticated `GET /api/v1/admin/galleries` response. Keep public gallery responses unchanged.
- Count D1 photo rows for that gallery except rows in `deleting` or `deleted` state, including photos in unfinished imports. An empty gallery reports zero.
- Show a second localized badge beside storage in the admin list, with singular and plural labels in FR and EN.

## Consequences

The value agrees with the publication summary total and updates when the admin list is refetched. It represents D1 photo records, not R2 objects. No migration or dependency is needed.
