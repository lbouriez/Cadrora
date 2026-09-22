# ADR-005: Gallery lifecycle and presentation settings

Status: accepted on 2026-09-21.

## Context

Photographers need to withdraw a gallery temporarily without destroying it, permanently remove all gallery-owned data when required, and decide which of Cadrora's French and English translations visitors may use. The original internal model called galleries `events`; renaming that database and every API route would create migration and integration risk without improving the owner experience.

Cloudflare D1, R2, and Vectorize do not share a transaction. A synchronous delete could remove D1 references before provider cleanup succeeds, lose the exact objects that remain, or time out on a large gallery.

## Decision

- Public and owner-facing copy uses **gallery**. Existing `events` tables, identifiers, source types, and `/api/v1/events/*` routes remain compatibility contracts.
- `events.offline_at` is a reversible availability fence. It leaves photos, vectors, and publication state intact while making public metadata, media, unlock, crawler, and search routes unavailable.
- `events.deleting_at` is the irreversible deletion fence. The request requires the exact current gallery title in its JSON body, revokes protected grants, cancels writable imports, freezes photos, and enqueues one idempotent `delete_gallery` job.
- Gallery cleanup waits five minutes for already accepted Worker requests to quiesce. It deletes only R2 keys and Vectorize IDs selected through that gallery's D1 relationships, then removes dependent D1 rows and the gallery. Shared face-model objects are never part of gallery cleanup.
- A failed gallery cleanup remains pending with bounded exponential delay instead of becoming an invisible terminal failure. Provider deletes and D1 completion remain idempotent.
- `site_settings.enabled_languages` contains one or more unique supported languages. `default_language` must be included. One enabled language hides the public language control and enforces that language; multiple languages expose the visitor control.

## Consequences

- Offline and delete remain visibly and technically distinct.
- A deletion may remain listed as in progress while a provider is unavailable, but it cannot become publicly available again.
- Internal code continues to use `event` in compatibility-sensitive areas; new user-facing text must not expose that implementation term.
- Adding another language requires translation resources and expanding the shared language schema before it can be selected.
