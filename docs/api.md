# API reference

Base path: `/api/v1`. All API failures are JSON objects with `code`, `message`, and `requestId`; `message` is an i18n key, not a guaranteed human-facing sentence. `/api/*` never falls back to SPA HTML. All admin responses are `Cache-Control: no-store`.

This reference reflects routes registered by `src/server/app.ts` on 2026-09-22. Gallery HTTP routes use `/galleries` consistently. Some TypeScript and D1 identifiers still use `eventId`; those identifiers are implementation details and do not create an `/events` alias.

## Authentication

| Context | Requirement |
| --- | --- |
| Admin routes | Worker-verified password session or Cloudflare Access assertion. State-changing methods also need a same-origin `Origin` header. |
| Protected event routes and protected media | Current signed event-grant cookie for the event and its access version. |
| Public event routes | No grant, but only published public events are listable. |
| Face search | Same event-access rule plus server-side facial-search eligibility. |

### Admin session routes

| Method and path | Input | Result |
| --- | --- | --- |
| `POST /admin/login` | JSON `{ password, turnstileToken }` | A `Session` JSON object and a secure opaque session cookie in password mode. Disabled in Cloudflare Access mode. |
| `POST /admin/logout` | No body | `204`; revokes a password session and clears the cookie. |
| `GET /admin/session` | None | Current `Session`; password sessions rotate. |
| `GET /admin/site` | None | Owner-facing site settings plus effective `quotas`, deployment `quotaCeilings`, and current media/gallery/face `usage`. The showcase demo may read this exact endpoint but cannot update it. |
| `PATCH /admin/site` | Validated public site name, language/theme, enabled service keys, contact fields, optional complete map centre/radius, nullable GA4 Measurement ID, plus `{ "quotas": { "galleryLimit": 10, "storageLimitBytes": 2000000000, "faceLimit": 5000 } }` | Persists public settings and owner self-limits. Every quota must be positive and no greater than its deployment ceiling. |

`password` is 1–200 characters at the transport boundary; strength belongs in operator provisioning. `turnstileToken` is required and at most 2,048 characters. Never send credentials from a cross-origin client.

Authentication failures expose only application-safe codes and a request ID. `TURNSTILE_FAILED` means the submitted challenge was rejected; `TURNSTILE_UNAVAILABLE` means verification could not be completed. Protected-event unlock can additionally return `INVALID_EVENT_PASSWORD`, `EVENT_PASSWORD_UNAVAILABLE`, or `EVENT_GRANT_UNAVAILABLE`. Provider tokens, secrets, visitor IPs, submitted passwords, the auth pepper, and stored verifiers are never API diagnostics.

## Galleries

| Method and path | Access | Input/result |
| --- | --- | --- |
| `GET /galleries` | Public | Lists published, online galleries enabled for public listing, newest by creation time. Public entries include `createdAt`; protected previews include `id`, `slug`, `title`, `startsAt`, `createdAt`, and `description`, but no cover or photo URL. |
| `GET /site` | Public | Validated public `SiteSettings` singleton; the static portfolio does not depend on it. |
| `GET /galleries/:eventId` | Public or grant | Public event metadata, or `401` for a protected event without access. `eventId` may be the stored ID or slug. |
| `GET /galleries/:eventId/preview` | Public | Title, description, event date, and creation date of a published, online protected gallery, including one hidden from lists. No cover or photo URL. The full gallery still requires its password. |
| `POST /galleries/:eventId/unlock` | Public + Turnstile | `{ password, turnstileToken }`; on success `{ unlocked: true }` and an event-grant cookie. |
| `GET /galleries/:eventId/photos?cursor=&limit=` | Public or grant | Published photos, their revisioned derived-source URLs, and a revision-bound cursor. `limit` is 1–100 and defaults to 40. |
| `GET /admin/galleries` | Admin | All galleries, including draft, unlisted, offline, and deletion-pending. |
| `POST /admin/galleries` | Admin | Creates a gallery; returns `201` with the full internal event record. |
| `PATCH /admin/galleries/:eventId` | Admin | Partial gallery update; slug is intentionally absent from the update schema. A deletion-pending gallery rejects updates. |
| `DELETE /admin/galleries/:eventId` | Admin | Body `{ "confirmation": "Exact gallery title" }`; returns `202 { "deletionQueued": true }`, removes visitor access immediately, and queues complete gallery-owned D1/R2/Vectorize cleanup. |

Gallery creation accepts:

```json
{
  "title": "Required title",
  "slug": "optional-stable-slug",
  "description": "optional or null",
  "startsAt": "2026-09-20T18:30:00.000Z",
  "timezone": "America/Toronto",
  "visibility": "draft",
  "access": "public",
  "password": "required when protected",
  "allowDownloads": false,
  "faceSearchEnabled": false,
  "nearbySearchEnabled": false,
  "showPhotoMetadata": false,
  "showOnGalleryPage": true,
  "keepOriginals": false,
  "retentionDays": null
}
```

Valid visibility values are `draft`, `published`, and `unlisted`; access values are `public` and `protected`. `showOnGalleryPage` defaults to `true` and controls inclusion in the site's public gallery lists, not direct-link access or photo authorization. `showPhotoMetadata` controls the authorized gallery viewer's filename, capture date/time, and dimensions panel and defaults to `false`. The capture instant comes from JPEG `DateTimeOriginal` plus its offset, or the gallery timezone when the camera omitted one; upload time is never substituted. Changing a protected password invalidates earlier grants by increasing the access version. A stale photo cursor returns `409` rather than silently changing page membership.

## Imports and media ingress

| Method and path | Access | Input/result |
| --- | --- | --- |
| `POST /admin/galleries/:eventId/imports` | Admin | `{ id, totalPhotos }`; creates or resumes a natural-ID import. |
| `POST /admin/imports/:importId/photos` | Admin | `{ chunkNumber, photos }`, where `photos` contains 1–50 declarations. |
| `PUT /admin/photos/:photoId/variants/:variant` | Admin | Raw JPEG/WebP bytes plus verified metadata headers; returns `{ variant }`. |
| `POST /admin/photos/:photoId/finalize` | Admin | Strict empty JSON object `{}`; returns `{ import, photo }`. |

Variant headers are `Content-Type`, `X-Cadrora-Byte-Size`, `X-Cadrora-Checksum-Sha256`, `X-Cadrora-Width`, and `X-Cadrora-Height`. The Worker accepts JPEG/WebP variants only and verifies byte count, magic bytes, checksum, application caps, and the D1-derived storage key. It never accepts a caller-supplied R2 key.

## Publication, deletion, and usage

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /admin/galleries/:eventId/publication` | Admin | Current readiness and publication summary for one event. |
| `POST /admin/galleries/:eventId/publish` | Admin | `{ visibility: "published" \| "unlisted" }`; atomically promotes every ready photo variant and changes the draft event visibility. It does not upload or process images and does not wait for optional facial indexing. Returns the publication summary or `409` if media is not ready. |
| `PUT /admin/galleries/:eventId/publication` | Admin | `{ state: "published" \| "unlisted" \| "offline" }`; changes visitor availability without deleting media or AI data. Offline revokes active protected-gallery grants; republishing reuses ready variants. |
| `DELETE /admin/photos/:photoId` | Admin | `204`; removes access first and queues cleanup. |
| `GET /admin/usage` | Admin | Application usage snapshot: events, photos, variant bytes, faces, and recorded vector-query dimensions. |

The usage endpoint is not Cloudflare billing data and is not proof that queued deletion has completed. Taking a gallery offline is reversible and preserves provider objects. Permanent gallery deletion is title-confirmed, asynchronous, and never removes shared model artifacts.

## Face-search routes

| Method and path | Access | Input/result |
| --- | --- | --- |
| `POST /admin/photos/:photoId/faces` | Admin | Model ID, generation, expiry, and 1–100 128-number embeddings. |
| `POST /galleries/:eventId/face-search` | Event access | `{ embedding, cursor? }`; possible matches and optional signed cursor. |
| `GET /galleries/:eventId/photos/:photoId/related` | Event access | Up to four same-gallery photos before and four after the source capture instant, limited to five minutes in each direction; returns none when the source has no capture instant. |
| `POST /admin/galleries/:eventId/purge-faces` | Admin | `202 { "queued": true }` when a purge job is queued. |

These routes are registered, but they fail closed when `FACE_INDEX`, model objects, expiry state, or cursor-signing material is unavailable. See [`face-search.md`](face-search.md).

## Models and media

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /models/v1/face_detection_yunet_2023mar.onnx` | Public immutable | Only if the allowlisted object exists in `MODELS_BUCKET`. |
| `GET /models/v1/face_recognition_sface_2021dec.onnx` | Public immutable | Only if the allowlisted object exists in `MODELS_BUCKET`. |
| `GET /media/:eventId/:photoId/:revision/:variant` | Public or event grant | Streams an authorized published variant. |

Media variant is one of `thumb`, `small`, `medium`, `large`, `download`, or `original`; no caller-provided storage key is accepted. Public revisioned media is immutable; protected media is private for one hour. A download variant additionally checks the event’s `allowDownloads` setting.

## Site settings

`GET /api/v1/site` uses a 60-second public cache policy. The public shell reads `themeMode`, `enabledLanguages`, and `defaultLanguage` from this endpoint. One enabled language is enforced with no language button; two expose the visitor choice. If the request fails, the shell preserves its build-time language and visitor-choice fallbacks. Portfolio content and contact details remain build-time static, so an API outage cannot blank the photographer website.
