# ADR-054: Optional session pricing packages and practical information

Status: accepted by the owner's 2026-10-25 request. Extends ADR-028 and ADR-032.

## Decision

Each language in service copy gains optional `tariffs` and `goodToKnow` fields in the existing `site_services.copy_json`. A tariff has a required `name` (120 characters), `price` (160 characters), and short `summary` (600 characters). At most eight tariffs are allowed per language. Prices remain owner-authored text, including currency; this adds no booking, payment or price calculation. `goodToKnow` accepts up to 1,000 characters. Existing copy without these fields remains valid.

The shared session dialog retains the legacy price display when tariffs are absent or empty. One tariff renders a simple price line and its summary. Multiple tariffs render the existing `priceRange` as a short overview, followed by a labelled bulleted list of names, prices and summaries. Optional practical information renders after the session inclusions, under “Good to know” / “Bon à savoir”. Blank information produces no block.

The existing bilingual admin editor supports adding, editing and removing tariffs and editing practical information. Adding or removing a row updates both language arrays together; all tariff fields must be filled in both languages, consistent with existing bilingual session copy. The shared Zod schemas validate stored copy, public responses and owner writes. Existing authorization and media contracts remain unchanged.

## Rollout

Push and deploy shared support before migrating Atelier Giulia content: an older strict schema cannot read the additional fields. A subsequent content-only migration moves the already approved packages and practical information out of `details`. Preserve unrelated owner edits, photos and visibility, and avoid duplicate legacy paragraphs. No new table, dependency, route or public page is needed. Do not roll back to the old schema while the new fields remain stored.

## Validation

Cover old copy, zero/one/multiple packages, blank practical information, schema bounds, bilingual admin save/reload and removal, and FR/EN desktop/phone dialog layout and keyboard behavior on both profiles. Validate the later migration separately for installation scoping, preservation, schema compatibility and repeat application.
