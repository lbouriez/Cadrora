# ADR-030: Configurable Home introduction buttons

Status: accepted by the owner's 2026-09-27 request. This revises the fixed two-button portion of ADR-029.

## Context

The Home introduction editor had a mandatory first button and a toggle for a second button. It could not add a third button, and the button styles were tied to their positions.

## Decision

- Store an ordered list of zero to six buttons in the existing `home_hero_copy` document. Each button has required FR/EN text, one approved internal destination, and the shared primary or secondary theme style. No custom colour or external URL is accepted.
- The admin editor can add or remove buttons and uses the shared translation field for each button's text. Reset restores the profile's two example buttons along with the rest of the introduction.
- The public Home page renders the list in order. On narrow screens, an unmatched last button spans the two-column action row. The compiled profile's two buttons remain the fallback when no D1 override exists.
- Existing D1 documents with `primaryHref`, `secondaryHref`, and `showSecondary` are parsed into the ordered list on read. Saving writes the new shape; no D1 migration is required.
- 2026-10-19, maintainer-approved showcase clarification: allow the internal `#demo` and `#installation` destinations. The shared Home sections provide these anchors; Cadrora uses them to separate trying the product from installing it. If the demo is unavailable, its default action becomes the setup action and duplicate destinations are collapsed. Owner-written copy remains authoritative. This does not introduce profile-capability controls or change Atelier's immersive composition.

## Consequences

Changing a button does not add a public API request or alter static Home HTML delivery. The list limit bounds the size of this marketing copy in D1 and the public response.
