# Public photographer website

## Scope

Cadrora is both an event-gallery application and the photographer's public website. The two surfaces share the React build and visual system, but they have different availability and authorization characteristics:

- `/` presents the photographer, services, and currently published public events;
- `/services` describes the available portrait, wedding, and event services;
- `/galleries` presents the demonstration journeys and live public galleries; no legacy `/events` alias is registered;
- `/contact` publishes direct contact coordinates without a form or third-party service;
- `/privacy` explains gallery and face-search privacy;
- `/e/*` is the event-gallery surface and may require an event grant;
- `/admin/*` is always authenticated and Worker-guarded.

The website shell must remain useful when the event API is unavailable. A gallery-list failure therefore renders a quiet status message and does not replace the landing page with an error screen.

## Public profile configuration

Public contact content is compiled into static assets from `VITE_*` build variables. These values are public by design and must never contain secrets.

| Variable | Meaning | Required |
| --- | --- | --- |
| `VITE_APP_NAME` | Studio or public brand name | Yes; defaults to `Cadrora` locally |
| `VITE_SITE_DEFAULT_LANG` | Initial language, `fr` or `en`; a visitor choice is then remembered locally | No; defaults to `fr` |
| `VITE_PHOTOGRAPHER_NAME` | Photographer name used in the introduction; replaces the fictional demo name | No |
| `VITE_CONTACT_PHONE` | Displayed phone number and `tel:` link; replaces the fictional demo number | No |
| `VITE_CONTACT_EMAIL` | Displayed email and `mailto:` link; replaces the fictional demo email | No |
| `VITE_CONTACT_ADDRESS` | Studio or business address; replaces the fictional demo location | No |
| `VITE_SERVICE_AREA` | Cities or region served; replaces the fictional demo area | No |
| `VITE_GA_MEASUREMENT_ID` | Optional public GA4 Measurement ID | No; analytics remains disabled when absent |

The checked-in Cadrora showcase deliberately provides fictional, clearly labelled template contact values so a fresh deployment is not an empty shell. A real operator must replace them before launch. The canonical reader remains `src/app/public/siteProfile.ts`; do not duplicate public profile values in components or translations.

The canonical reader is `src/app/public/siteProfile.ts`. Do not access public build variables throughout components or duplicate the profile in translations.

## Runtime appearance setting

An authenticated owner can choose the new-visitor language and visitor-facing appearance at `/admin/settings`. Theme policies are `light`, `dark`, `both`, or `system`. `both` displays a Light / Dark switch and preserves a visitor’s local choice; a fixed policy removes the switch; `system` follows live `prefers-color-scheme` changes without overwriting a saved visitor choice. These are small D1-backed runtime settings, not Vite variables, so they can change without rebuilding public content. The public shell treats this read as optional and falls back to the build language and `both` if `/api/v1/site` is unavailable.

## Design and content rules

- Keep all user-facing copy in both FR and EN resources.
- Reuse the semantic tokens and shared button primitives.
- Do not load remote fonts, maps, forms, or stock images. Google Analytics is the sole supported tracker exception: it is optional, hard-limited to marketing routes, and loaded only after explicit visitor consent.
- The landing page and contact page must remain static except for the public event list.
- A protected or unlisted event is never promoted by the public landing-page query.
- Treat the supplied logo at `public/brand/cadrora-logo.png` as the canonical brand asset.

## Public experience system

The public shell is deliberately touch-first: controls meet the shared `--control-min-size` target, the header is a compact frosted surface, and theme/language actions use the shared `IconButton` primitive rather than page-specific controls. `tokens.css` owns colour, spacing, elevation, and motion values; `components.css` owns button and icon-button interaction states. Do not add an isolated colour, radius, or animation to a public page when a semantic token or shared primitive can express it.

`public.css` defines the public card family used by the landing page and `/galleries`: compact demo journeys, image-led service cards, and image-led live-gallery cards. The gallery card renderer is shared in `PublicEventCards.tsx`, so a CTA is always a themed button rather than an underlined text link. The optional AI journey is the primary demo action and must point to `/e/find-your-photos/find`; demo credentials belong only on the protected-gallery unlock or demo-login screen where they are needed, never in a promotional card.

Motion is limited to press feedback, small elevation changes, and image zooms, all using the shared motion tokens. Respect `prefers-reduced-motion`; no transition is required to understand or operate the site. The fictional triptych at `public/brand/demo-services-triptych.png` is project-owned demonstration media: it may be replaced by an operator's licensed imagery, but it must not imply that its fictional people are clients.

## Validation

After changing the public site, run `npm run check`, `npm run test`, and `npm run build`. Also inspect `/` and `/contact` at a 390-pixel viewport and a desktop viewport, in FR and EN, with contact values both configured and empty.
