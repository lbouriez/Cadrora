# ADR-055: Atelier Direction A and shared session/contact presentation

Status: accepted by the owner's 2026-11-02 request selecting Direction A and A02, A06, A07, A09, A10, A12, A13, A14, A16 and A17. Refines ADR-043 and ADR-054 without adding a dependency.

## Ownership and presentation

PB owns the shared consent panel, session detail layout, contact context, and About accessibility. PA retains all content editing, including an explanatory hint for informative versus decorative portrait alternatives. Atelier-specific typography, scrims, alignment and animation easing belong to `sites/atelier-giulia/theme.css`; the profile selects `home.slideDirection = 'horizontal'`, `home.immersiveFooter = 'always'` and `home.sessionIntroduction = false`. Cadrora's editorial profile and its existing work remain intact.

Following the owner's clarification, the existing Swiper moves left/right like pages, with a 1200 ms horizontal push and text fade at a constant photo scale. Ordinary vertical mouse-wheel input, horizontal touch swipes and keyboard input advance one slide per gesture. The profile disables photo zoom through `home.slidePhotoZoom = false`; shared consumers retain their existing default. Short horizontal dashes sit above the footer and consent panel, with 44 px targets and an emphasized current slide. On narrow screens the indicator strip scrolls horizontally, keeping the current session visible without moving the document. Slide content reserves space above the strip. The shared slider retains its vertical default for other consumers. Reduced motion disables the animation. The header and footer remain available on every prepared slide. The measured masthead, footer and consent heights reserve space; only overflowing text scrolls vertically when necessary, leaving the action visible. Inactive slides remain inert. Owner order, eligible sessions, photo revisions, framing, translations and page visibility remain authoritative. No introduction or studio data is invented to fill gaps.

Short viewports compact the immersive header and spacing to reserve the bottom controls. Landscape uses a single footer row where space permits, including with both owner construction and privacy notices visible. Long text retains its own scrolling region and the session action stays outside it.

The shared dialog puts summary, duration, owner price overview and one generic contact action first, followed by cards for every supplied package, practical information and inclusions. The generic action is not repeated at the bottom; package actions remain distinct because they carry the selected package to Contact. Full descriptive/legacy text remains available in a native disclosure. Native disclosures participate in the shared focus trap. No package is recommended automatically and no amount is parsed or calculated. Prices remain exact owner strings.

## Contact and sharing contracts

Contact accepts a schema-validated `session` ID and optional zero-based `tariff` index from 0 through 7. Only a visible session returned by the current public catalogue can supply localized labels for the encoded email subject. Unknown, hidden or unavailable sessions produce a generic email; invalid/missing package indices retain session-only context. The index resolves against the current catalogue and is not a persistent booking identifier. Email and phone appear first. Copying the email has localized success/failure feedback and never sends a message.

`GET /home-hero-image/:variant` additionally accepts `source=hero|first-session`, with omitted source retaining the old hero behavior. Atelier's static and client social metadata select `first-session`. The Worker uses the same ordered public catalogue and Home eligibility as the frontend, then returns a `302` to the published versioned session variant with `Cache-Control: no-store`; pending revisions and hidden sessions cannot become share images. Versioned media keeps its existing D1/R2 publication checks. If the first Home session has no uploaded variant, the existing reserved Home image/default behavior remains the fallback. There is no private-gallery lookup and no new admin setting.

## Content and rollout

Migration 049 changes only known English Atelier titles/currency formatting, matching installation name/email and each old field independently. It preserves amounts, French, package contents, owner edits, images, settings and placement, and is idempotent. It is separate from local UI verification and must be applied through the existing migration release process when this change is deployed. No new table is required.

The photographer chooses the About alternative in the existing bilingual admin fields; explicit empty alternatives remain decorative. No biography, process promise, FAQ answer, region, family price or portfolio is fabricated. A01, A03, A04, A05 and A11 are excluded, and A08/A15 were not selected. The construction notice remains controlled by admin. Existing outage/fallback behavior is not broadened.

## Validation

Check/test and both profile builds; FR/EN desktop/mobile session-to-contact journeys; one/multiple/empty packages; disclosure/focus restoration; clipboard success/failure; malformed query inputs; wheel/touch/keyboard/reduced motion; first visit at 390×844, 320×568 and 844×390; enlarged/long owner copy; privacy reopening and analytics gating; owner admin pricing/framing; share image revision/order and migration preservation. Browser fixtures are not proof of a production deployment or real admin save.
