# Privacy and data handling

This document describes the current implementation. It is not legal advice, a privacy notice tailored to a jurisdiction, or a promise of regulatory compliance. An operator remains responsible for lawful basis, notices, retention choices, and data-subject handling.

## What the system processes

| Data category | Current handling |
| --- | --- |
| Public website profile | Studio name, email, telephone, address, service area, enabled services, map centre/radius, and optional GA4 ID are public D1 site settings with optional compiled `VITE_*` fallbacks. The official opt-in showcase seeds fictional contact values into D1; the client has no hardcoded contact coordinates. |
| Event metadata | D1 stores title, description, time, timezone, visibility, access settings, and publication state. |
| Gallery media | Source images stay in the photographer browser during import. Derived variants are stored in private R2 and served only after Worker authorization. |
| Source metadata | The browser retains only a normalized capture instant from JPEG `DateTimeOriginal` and optional `OffsetTimeOriginal` as a D1 field. Pixel re-encoding strips the EXIF/XMP payload from stored variants, including GPS, serial, and comments. |
| Event passwords | D1 stores a domain-separated HMAC-SHA-256 verifier, never the clear password. Its key is the separate Worker-only `AUTH_PEPPER`; admin and event credentials use different domains. |
| Admin authentication | D1 stores password-session token hashes, session subject, expiry, and revocation time. It does not store the opaque raw token. |
| Event grants | A signed cookie contains only event ID and access version. It does not make an event public or survive a password-version change. |
| Facial-search data | A visitor image remains local. The Worker receives a 128-number embedding; D1 stores gallery-scoped face/vector references and optional expiry, while optional Vectorize stores vectors. |
| Optional analytics | A GA4 script may run only on public marketing routes after explicit consent and a valid owner-configured D1 Measurement ID. Gallery, admin, media, and face-search routes are excluded. |
| Optional map | The Contact page creates an OpenStreetMap iframe only after the visitor clicks to display it; no key is required. If the operator supplies a restricted public Google Maps Embed API key, the same click instead creates a Google iframe. The chosen provider may receive the visitor IP address and set cookies. Without a click, Cadrora makes no map request. An outbound Google Maps link remains available. |

Withdrawing analytics consent sets Google's disable flag and removes the first-party `_ga` cookies available to the current hostname. It stops future collection from Cadrora; it does not claim to erase information already retained by Google.

## What the system does not do by design

- It does not upload a visitor selfie for facial search.
- It does not expose embeddings, face coordinates, or vector IDs in public API responses.
- It does not create cross-event biometric profiles or claim to identify a person.
- It does not put event photos into build assets or a shared public cache when access is protected.
- `/contact` has direct contact details and no contact form, remote font, or third-party contact service. The OpenStreetMap or optional Google map is click-to-load only; contact details remain available without it.
- It does not load Google Analytics before consent or send gallery slugs, event titles, admin paths, media paths, or face-search paths to Google.

## Access and retention

Protected event access needs a current event grant and the current access version. Rotating an event password increments that version. Admin state-changing routes require both Worker authentication and a same-origin `Origin` header.

Facial embeddings are gallery-scoped and may expire. With a configured gallery retention period, the server rejects an expiry later than the allowed gallery window. D1 excludes expired matches from every response even if Vectorize returns one during the short interval before provider cleanup. A 15-minute Worker Cron Trigger enqueues cutoff-scoped expired-face purges and runs maintenance, but a queued cleanup must not be represented as immediate physical deletion; verify the specific job completed.

## Operator responsibilities and gaps

The repository does not currently include a privacy-request workflow, consent-record export, account deletion flow, remote backup policy, legal notice template, or automatic retention scheduler. Before collecting gallery or biometric data in production, establish those operator processes outside this source tree and confirm the deployed data locations, subcontractors, and retention practices.

For an incident, avoid copying passwords, raw vectors, cookies, selfies, or private EXIF into tickets. Preserve request IDs and non-sensitive error codes, restrict access to the affected Cloudflare account, and follow [`SECURITY.md`](../SECURITY.md).
