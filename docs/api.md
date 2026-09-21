# API reference

Base path: `/api/v1`. All API failures are JSON objects with `code`, `message`, and `requestId`; `message` is an i18n key, not a guaranteed human-facing sentence. `/api/*` never falls back to SPA HTML. All admin responses are `Cache-Control: no-store`.

This reference reflects routes registered by `src/server/app.ts` on 2026-09-20.

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
| `GET /admin/site` | None | Owner-facing `SiteSettings`, including `themeMode`. The showcase demo may read this exact endpoint but cannot update it. |
| `PATCH /admin/site` | `{ "themeMode": "light" \| "dark" \| "both" }` | Persists the public colour policy. |

`password` is 1–200 characters at the transport boundary; strength belongs in operator provisioning. `turnstileToken` is required and at most 2,048 characters. Never send credentials from a cross-origin client.

Authentication failures expose only application-safe codes and a request ID. `TURNSTILE_FAILED` means the submitted challenge was rejected; `TURNSTILE_UNAVAILABLE` means verification could not be completed. Protected-event unlock can additionally return `INVALID_EVENT_PASSWORD`, `EVENT_PASSWORD_UNAVAILABLE`, or `EVENT_GRANT_UNAVAILABLE`. Provider tokens, secrets, visitor IPs, submitted passwords, the auth pepper, and stored verifiers are never API diagnostics.

## Events

| Method and path | Access | Input/result |
| --- | --- | --- |
| `GET /events` | Public | Lists published, public events only. |
| `GET /site` | Public | Validated public `SiteSettings` singleton; the static portfolio does not depend on it. |
| `GET /events/:eventId` | Public or grant | Public event metadata, or `401` for a protected event without access. `eventId` may be the stored ID or slug. |
| `POST /events/:eventId/unlock` | Public + Turnstile | `{ password, turnstileToken }`; on success `{ unlocked: true }` and an event-grant cookie. |
| `GET /events/:eventId/photos?cursor=&limit=` | Public or grant | Published photos, their revisioned derived-source URLs, and a revision-bound cursor. `limit` is 1–100 and defaults to 40. |
| `GET /admin/events` | Admin | All events, including draft and unlisted. |
| `POST /admin/events` | Admin | Creates an event; returns `201` with the full event. |
| `PATCH /admin/events/:eventId` | Admin | Partial event update; slug is intentionally absent from the update schema. |
| `DELETE /admin/events/:eventId` | Admin | Deletes an event only after every photo is already in the deleted state. |

Event creation accepts:

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
  "keepOriginals": false,
  "retentionDays": null
}
```

Valid visibility values are `draft`, `published`, and `unlisted`; access values are `public` and `protected`. Changing a protected password invalidates earlier grants by increasing the access version. A stale photo cursor returns `409` rather than silently changing page membership.

## Imports and media ingress

| Method and path | Access | Input/result |
| --- | --- | --- |
| `POST /admin/events/:eventId/imports` | Admin | `{ id, totalPhotos }`; creates or resumes a natural-ID import. |
| `POST /admin/imports/:importId/photos` | Admin | `{ chunkNumber, photos }`, where `photos` contains 1–50 declarations. |
| `PUT /admin/photos/:photoId/variants/:variant` | Admin | Raw JPEG/WebP bytes plus verified metadata headers; returns `{ variant }`. |
| `POST /admin/photos/:photoId/finalize` | Admin | Strict empty JSON object `{}`; returns `{ import, photo }`. |

Variant headers are `Content-Type`, `X-Cadrora-Byte-Size`, `X-Cadrora-Checksum-Sha256`, `X-Cadrora-Width`, and `X-Cadrora-Height`. The Worker accepts JPEG/WebP variants only and verifies byte count, magic bytes, checksum, application caps, and the D1-derived storage key. It never accepts a caller-supplied R2 key.

## Publication, deletion, and usage

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /admin/events/:eventId/publication` | Admin | Current readiness and publication summary for one event. |
| `POST /admin/events/:eventId/publish` | Admin | `{ visibility: "published" \| "unlisted" }`; returns publication summary or `409` if media is not ready. |
| `DELETE /admin/photos/:photoId` | Admin | `204`; removes access first and queues cleanup. |
| `GET /admin/usage` | Admin | Application usage snapshot: events, photos, variant bytes, faces, and recorded vector-query dimensions. |

The usage endpoint is not Cloudflare billing data and is not proof that queued deletion has completed.

## Face-search routes

| Method and path | Access | Input/result |
| --- | --- | --- |
| `POST /admin/photos/:photoId/faces` | Admin | Model ID, generation, expiry, and 1–100 128-number embeddings. |
| `POST /events/:eventId/face-search` | Event access | `{ embedding, cursor? }`; possible matches and optional signed cursor. |
| `GET /events/:eventId/photos/:photoId/related` | Event access | Related photo references for a valid search context. |
| `POST /admin/events/:eventId/purge-faces` | Admin | `202 { "queued": true }` when a purge job is queued. |

These routes are registered, but they fail closed when `FACE_INDEX`, model objects, expiry state, or cursor-signing material is unavailable. See [`face-search.md`](face-search.md).

## Models and media

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /models/v1/face_detection_yunet_2023mar.onnx` | Public immutable | Only if the allowlisted object exists in `MODELS_BUCKET`. |
| `GET /models/v1/face_recognition_sface_2021dec.onnx` | Public immutable | Only if the allowlisted object exists in `MODELS_BUCKET`. |
| `GET /media/:eventId/:photoId/:revision/:variant` | Public or event grant | Streams an authorized published variant. |

Media variant is one of `thumb`, `small`, `medium`, `large`, `download`, or `original`; no caller-provided storage key is accepted. Public revisioned media is immutable; protected media is private for one hour. A download variant additionally checks the event’s `allowDownloads` setting.

## Site settings

`GET /api/v1/site` uses a 60-second public cache policy. The public shell reads its optional `themeMode` from this endpoint; if it fails, it preserves the visitor-choice fallback. Portfolio content and contact details remain build-time static, so an API outage cannot blank the photographer website.
