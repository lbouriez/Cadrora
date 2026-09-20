# Face-search guide

Face search is optional, event-scoped, and not an identity system. It is designed to help a visitor find **possible matches** in one event; it must never be described as recognition, identification, or a cross-event profile.

## Data and access boundary

The visitor consents, chooses or captures an image, and processes it in the browser. The raw image remains a browser `ImageBitmap`; it is not sent to the Worker. YuNet detects faces locally, the visitor selects one face, and SFace emits a 128-value finite, L2-normalized embedding. Only that embedding is posted to the search endpoint.

The Worker still independently checks event visibility, protected-event grant/version, event face-search enablement, active generation, expiry, and vector availability. A search never issues an event grant. Responses include bounded score, photo ID, revisioned thumbnail URL, moment, and capture time—not embeddings, coordinates, vector IDs, or identity claims.

## Indexing

The client may submit faces only through an authenticated admin route. D1 uses deterministic face/vector IDs, natural keys, and partitions no larger than 100 faces. Vector namespaces are `face:{eventId}:generation:{generation}` and only `partition_id` is stored as indexed metadata.

The service initially queries at most 100 results without values or metadata, filters scores below `0.363`, and uses an HMAC-signed cursor for partition fan-out. Cursor-signing material is derived from `TURNSTILE_SECRET_KEY`; missing it fails search closed.

When event retention is configured, an embedding expiry cannot exceed event start plus retention days. Purge disables face search in D1 first, then queues provider cleanup.

## Model supply chain

`scripts/models/manifest.json` pins exact YuNet and SFace source URL, license, byte size, SHA-256, preprocessing, metric, and R2 destination key. Run:

```powershell
node scripts/models/download.mjs
```

The script reuses only checksum-valid artifacts and writes an ignored upload manifest. Use your authorized Cloudflare upload process to place the verified files at those exact `models/v1/...` keys. The Worker serves only the two allowlisted names and marks them immutable.

## Current deployment status

The Worker currently registers model and face-search routes. However, `FACE_INDEX` is optional in the generated binding type and is **not configured in the current `wrangler.jsonc`**. Without an explicit Vectorize binding, facial search returns an unavailable error and galleries continue normally. Do not enable user-facing marketing for the feature until the binding, model objects, protected-event path, and real-device checks are complete.

The SPA includes a public find-route object, but its quality and privacy behavior require manual release validation on iPhone Safari: model-cache persistence, WASM memory, camera/file selection, multi-face selection, protected-event grants, expiry, and failure behavior. Desktop unit tests do not establish that evidence.

## Operator response

- If model download, model integrity, vector binding, or cursor signing fails, leave the gallery available and show the feature as unavailable.
- Do not upload a visitor selfie to “debug” a failed search.
- Do not use scores as identity confidence or make eligibility decisions from them.
- A queued purge is not physical provider deletion until the scheduled maintenance runner completes it and the job state is verifiably `completed`.

See [`privacy.md`](privacy.md) and [`technical/facial-search.md`](technical/facial-search.md) for the retention and code-level rules.
