# Public photographer website

## Scope

Cadrora is both an event-gallery application and the photographer's public website. The two surfaces share the React build and visual system, but they have different availability and authorization characteristics:

- `/` presents the photographer, services, and currently published public events;
- `/services` describes the available portrait, wedding, and event services;
- `/events` presents the demonstration journeys and live public events;
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

## Design and content rules

- Keep all user-facing copy in both FR and EN resources.
- Reuse the semantic tokens and shared button primitives.
- Do not load remote fonts, maps, forms, or stock images. Google Analytics is the sole supported tracker exception: it is optional, hard-limited to marketing routes, and loaded only after explicit visitor consent.
- The landing page and contact page must remain static except for the public event list.
- A protected or unlisted event is never promoted by the public landing-page query.
- Treat the supplied logo at `public/brand/cadrora-logo.png` as the canonical brand asset.

## Validation

After changing the public site, run `npm run check`, `npm run test`, and `npm run build`. Also inspect `/` and `/contact` at a 390-pixel viewport and a desktop viewport, in FR and EN, with contact values both configured and empty.
