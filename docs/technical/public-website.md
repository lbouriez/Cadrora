# Public photographer website

## Scope

Cadrora is both an event-gallery application and the photographer's public website. The two surfaces share the React build and visual system, but they have different availability and authorization characteristics:

- `/` presents the photographer, services, and currently published public events;
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
| `VITE_PHOTOGRAPHER_NAME` | Photographer name used in the introduction | No |
| `VITE_CONTACT_PHONE` | Displayed phone number and `tel:` link | No |
| `VITE_CONTACT_EMAIL` | Displayed email and `mailto:` link | No |
| `VITE_CONTACT_ADDRESS` | Studio or business address | No |
| `VITE_SERVICE_AREA` | Cities or region served | No |

Unset contact values are never replaced with invented coordinates. When every contact value is empty, `/contact` shows a clear pre-launch configuration notice. Configure at least the email or phone before a public launch.

The canonical reader is `src/app/public/siteProfile.ts`. Do not access public build variables throughout components or duplicate the profile in translations.

## Design and content rules

- Keep all user-facing copy in both FR and EN resources.
- Reuse the semantic tokens and shared button primitives.
- Do not load remote fonts, trackers, maps, forms, or stock images by default.
- The landing page and contact page must remain static except for the public event list.
- A protected or unlisted event is never promoted by the public landing-page query.
- Treat the supplied logo at `public/brand/cadrora-logo.png` as the canonical brand asset.

## Validation

After changing the public site, run `npm run check`, `npm run test`, and `npm run build`. Also inspect `/` and `/contact` at a 390-pixel viewport and a desktop viewport, in FR and EN, with contact values both configured and empty.
