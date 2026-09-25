# Public photographer website

## Scope

Cadrora is both an event-gallery application and the photographer's public website. The two surfaces share the React build and visual system, but they have different availability and authorization characteristics:

- `/` presents the photographer, services, and currently published public events;
- `/services` presents the owner-enabled portrait, family, wedding, brand, corporate, and childhood offerings as image-led cards;
- `/galleries` dynamically lists published public and protected galleries enabled for public listing, newest by creation date first; showcase journeys belong on `/` and no legacy `/events` alias is registered;
- `/contact` publishes direct contact coordinates without a form, plus a click-to-load OpenStreetMap card (or optional Google Maps card);
- `/privacy` explains gallery and face-search privacy;
- `/e/*` is the event-gallery surface and may require an event grant;
- `/admin/*` is always authenticated and Worker-guarded.

The website shell must remain useful when the event API is unavailable. A gallery-list failure therefore renders a quiet status message and does not replace the landing page with an error screen.

## Public profile configuration

Build-time presentation profiles live under `sites/<id>/site.ts` and are selected by `CADRORA_SITE`. The default `cadrora` profile retains the product showcase; `atelier-giulia` reuses the same pages/components with its own brand, section order, bilingual copy and semantic theme tokens. Put shared layout and interaction improvements in `src/app` so both sites inherit them. Use `pages` in a site definition only for a genuinely distinct marketing page; gallery, contact settings, privacy behavior, and admin remain shared. Profiles must not contain credentials or invented real-world contact coordinates. See [ADR-013](../decisions/ADR-013-site-profiles.md) and the [Atelier Giulia deployment runbook](../deployment.md#atelier-giulia-from-this-repository).

Public contact content has compiled `VITE_*` fallbacks and owner-editable D1 overrides. These values are public by design and must never contain secrets. D1 absence or API failure never blanks the public site.

| Variable | Meaning | Required |
| --- | --- | --- |
| `VITE_APP_NAME` | Studio or public brand name | Yes; defaults to `Cadrora` locally |
| `VITE_SITE_DEFAULT_LANG` | Initial language, `fr` or `en`; a visitor choice is then remembered locally | No; defaults to `fr` |
| `VITE_PHOTOGRAPHER_NAME` | Photographer name used in the introduction; replaces the fictional demo name | No |
| `VITE_CONTACT_PHONE` | Optional compiled phone fallback if D1/API is unavailable; D1 takes precedence | No |
| `VITE_CONTACT_EMAIL` | Optional compiled email fallback if D1/API is unavailable; D1 takes precedence | No |
| `VITE_CONTACT_ADDRESS` | Optional compiled address fallback if D1/API is unavailable; D1 takes precedence | No |
| `VITE_SERVICE_AREA` | Optional compiled service-area fallback if D1/API is unavailable; D1 takes precedence | No |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Optional public Google Maps Embed API key, restricted to this site's HTTP referrers and the Maps Embed API | No; without it the contact page embeds OpenStreetMap after a visitor click |

The client has no hardcoded contact coordinates. The opt-in Cadrora showcase seeds fictional contact values into the singleton D1 row only while that row is untouched; the Contact page does not display a demo disclaimer. A real operator sets the actual values in Admin Site settings before launch and may also provide real compiled fallbacks for outages. Null D1 fields use any configured compiled fallback; an empty string intentionally hides a field. The canonical fallback reader remains `src/app/public/siteProfile.ts`; do not duplicate public profile values in components or translations.

The canonical reader is `src/app/public/siteProfile.ts`. Do not access public build variables throughout components or duplicate the profile in translations. Site-specific copy overrides are merged into the shared FR/EN resources at initialization, not hardcoded in a page.

## Runtime site settings

An authenticated owner can set site name, new-visitor language, visitor appearance, and a GA4 Measurement ID under **Website** at `/admin/settings`. Theme policies are `light`, `dark`, `both`, or `system`. `both` displays a Light / Dark switch and preserves a visitor’s local choice; a fixed policy removes the switch; `system` follows live `prefers-color-scheme` changes. Under **Services**, the owner chooses a non-empty set of offerings shown on the landing and Services pages. Under **Contact**, the owner edits email, phone, studio location, service-area description, and a complete optional latitude/longitude/radius tuple. These are small D1-backed runtime settings, not Vite variables, so they can change without rebuilding public content. The public shell treats the read as optional and falls back to compiled profile values if `/api/v1/site` is unavailable. The public response is cached for 60 seconds; existing open pages may need a refresh.

The admin page presents Website, Usage & limits, Services, and Contact as separate anchored sections in one form. Keeping every section mounted preserves unsaved edits while an owner moves between them. The section navigation is touch-sized and sticky; saving remains a single explicit operation. The gallery dashboard shows existing galleries before the creation form, and a gallery's reversible availability control appears before its permanent deletion control, including on narrow screens. The read-only demo keeps controls interactive but disables final writes.

The GA4 ID must match `G-[A-Z0-9]{6,20}` or be null. With no ID, no Google tag loads. With a valid ID, only explicit analytics consent on the marketing-route allowlist loads `gtag.js`. Changing the ID uses the new runtime value, never arbitrary owner-provided script code. Gallery/admin/media/face-search paths remain unmeasured. The consent banner remains available through the footer.

Both `public/_headers` (static pages) and `src/server/middleware/securityHeaders.ts` (Worker routes) must retain the same consented GA4, no-Ads CSP destinations: the Google tag script host plus the Google Analytics beacon/image hosts. The browser test uses a fake D1 Measurement ID and intercepts the script request to prove consent and page-view wiring; it cannot prove that Google received a hit. After configuring a real GA4 property, verify a consented marketing page with Google's Tag Assistant and Analytics DebugView, and verify that gallery/admin routes stay unmeasured. Do not enable advertising destinations without revisiting the privacy decision and CSP.

The owner supplies the approximate travel centre and radius under **Contact**. The Cadrora showcase seeds Montréal and 125 km into this same D1 setting only if it is still at its initial, untouched value; subsequent owner edits or clearing the map are never overwritten. There is no hard-coded display radius in the Contact component. If the tuple is absent, the map card is hidden, while the rest of Contact remains useful. Without `VITE_GOOGLE_MAPS_EMBED_KEY`, a visitor can press **Display the map** on the local, region-neutral illustrated preview to load an OpenStreetMap iframe; no key or Google Cloud account is required. The preview asset `public/brand/service-area-preview.webp` is project-owned, contains no real map or location labels, and can be reused unchanged by other installations. The map and its tiles are fetched only after that click. The iframe provides OpenStreetMap attribution, also linked in the card once it is shown. The Google Maps outbound link is optional for visitors. The radius frames an approximate map view and is stated in text; it is not a polygon or exact travel guarantee. The community-hosted OpenStreetMap tile servers are best-effort and have a [usage policy](https://operations.osmfoundation.org/policies/tiles/); a high-traffic deployment should use a suitable tile provider or its own infrastructure. No bulk tile prefetching is permitted.

If the operator supplies a restricted `VITE_GOOGLE_MAPS_EMBED_KEY`, the click-to-load iframe uses the official Google Maps Embed API instead. Google requires a Cloud project with billing enabled even though the Maps Embed API currently lists no usage charge. See [Google's Embed API quickstart](https://developers.google.com/maps/documentation/embed/quickstart) and [key restrictions](https://developers.google.com/maps/api-security-best-practices).

## Design and content rules

- Keep all user-facing copy in both FR and EN resources.
- On a photographer's own site, address visitors as the studio using "we/you" ("nous/vous") or neutral wording. Do not refer to "the photographer" in the third person in visitor-facing gallery, contact, or privacy copy. Product-demo and owner-login copy may describe the application, but should not make a real studio sound like an external party.
- Write for visitors and photographers who do not know the implementation: describe what they can do and what happens to their photos, not Workers, databases, vectors, variants, or deployment details. Keep necessary settings such as a Google Analytics ID specific enough to act on. Preserve accurate consent, gallery-scope, cost-limit, and deletion disclosures in plain language.
- The privacy overview uses a demo-specific paragraph only when the showcase gate is enabled; other installations must not claim their people or contact details are fictional.
- Reuse the semantic tokens and shared button primitives.
- Do not load remote fonts, forms, or stock images. GA4 is consent-gated and marketing-route-limited. The contact map is click-to-load only; Google Maps is optional, OpenStreetMap is the keyless default.
- The landing page and contact page must remain static except for the public event list.
- A protected or unlisted event is never promoted by the public landing-page query.
- Treat the supplied logo at `public/brand/cadrora-logo.png` as the canonical brand asset.

## Public experience system

The public shell is deliberately touch-first: controls meet the shared `--control-min-size` target, the header is a compact frosted surface, and theme/language actions use the shared `IconButton` primitive rather than page-specific controls. `tokens.css` owns colour, spacing, elevation, and motion values; `components.css` owns button and icon-button interaction states. Do not add an isolated colour, radius, or animation to a public page when a semantic token or shared primitive can express it.

Below the tablet breakpoint, the shared header collapses navigation into an accessible menu on the same row as the brand and appearance controls. The landing-page CTAs use shorter FR/EN visual labels at narrow widths while retaining their full accessible names. Keep the hero photo selector scoped to the direct child image: descendant selectors also resize the small face-search portrait overlay. Service and gallery card images must preserve visible faces at both phone and laptop widths; a full-photo fit is preferable to cropping a face.

Return navigation on the gallery, face-search, and contact pages uses the shared `BackLink` component and its one `.back-link` theme rule. Generic public text-link styling applies only to unclassed anchors, so it cannot silently change a component link's colour or border.

The face-search entry presents consent and camera/file choices together. The two fictional test portraits are illustrated download cards so visitors can recognize the demo subjects before selecting a file. The privacy notice uses plain-language visitor copy; storage and authorization details stay in the technical documentation. When changing that copy, keep the separate gallery scope, mathematical-signature transfer, deletion timing, and analytics-consent boundaries accurate in both languages.

`public.css` defines the public card family used by the landing page and `/galleries`: compact demo journeys, image-led service cards, and image-led live-gallery cards. The gallery card renderer is shared in `PublicEventCards.tsx`, so a CTA is always a themed button rather than an underlined text link. The optional AI journey is the primary demo action and must point to `/e/find-your-photos/find`; demo credentials belong only on the protected-gallery unlock or demo-login screen where they are needed, never in a promotional card.

Motion includes press feedback, small elevation changes, image zooms, and shared `MotionReveal` section/card entrances using semantic tokens. The hero image, demo cards, services, and public gallery cards use the same reveal component. Respect `prefers-reduced-motion`: a browser requesting reduced motion sees the static presentation, with no entrance or hover transform; no transition is required to understand or operate the site, and browsers without IntersectionObserver show all content immediately. The fictional triptych, AI gallery cover, and brand/corporate/children photos in `public/brand/` are project-owned generated demonstration media: they may be replaced by an operator's licensed imagery, but must not imply that fictional people are clients. Gallery-card image crops use an upper focal point to preserve faces.

Text placed on photos uses the shared `--color-on-photo` and overlay tokens; never derive its foreground from `--color-background`, which becomes dark in dark mode and loses contrast against the photo overlay.

## Validation

After changing the public site, run `npm run check`, `npm run test`, `npm run build`, and the relevant Playwright tests. Inspect `/`, `/services`, `/galleries`, `/contact`, `/privacy`, the public gallery and finder, and the demo admin login at 320–390-pixel phone widths and a desktop viewport, in FR and EN. Verify the menu, consent panel, image focal points, and no horizontal overflow; check contact values both configured and empty.
