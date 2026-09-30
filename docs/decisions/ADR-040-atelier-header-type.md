# ADR-040: Atelier header and display type

Status: accepted, 2026-09-29; immersive header amended 2026-09-30. Extends ADR-013 and ADR-039.

## Context

The Atelier Giulia brief specifies a cream `#F6F1E7` header, warm ink navigation, and a fine serif such as Playfair Display. The previous immersive Home header was transparent over the photograph, so it looked unlike the interior pages and the approved reference. A system serif also varied across visitor devices.

## Decision

- Keep the shared header, navigation, theme controls, and menu behavior. Use the profile's semantic background and text tokens for the header on Home and interior pages, including the mobile layout. On the immersive Home photo, use the semantic background at 88% opacity so the photograph remains visible beneath the header; interior pages retain a solid background. The dark theme uses the corresponding dark semantic tokens.
- Self-host the Latin Playfair Display variable font in the Atelier profile, with its SIL Open Font License beside the font file. Use it through the profile's `--font-display` token; Cadrora retains its own font. No third-party font request is made at runtime.
- Uppercase the visible site name in the shared public brand link with CSS. Preserve owner-entered spelling in the DOM, document title, metadata, and admin data.

## Consequences

The first photograph remains full-viewport behind the translucent cream header, so its top band is faintly visible while the text stays legible. The font adds one small static asset to the Atelier build. Header position remains the same across routes.
