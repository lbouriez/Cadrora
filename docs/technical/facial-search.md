# Facial search implementation and integration

Facial search is optional. A missing `FACE_INDEX`, model object, cursor-signing secret, expired generation, or model validation failure disables only search; event galleries continue to operate.

## Root integration

The root Worker registers `registerFaceSearchRoutes(app)` and `registerFaceModelRoutes(app)`. `/models/*` is Worker-first and only two manifest-approved object keys can reach `MODELS_BUCKET`. The SPA registers `faceFindRouteObject` and installs its FR/EN resources.

The configured 15-minute Worker Cron Trigger calls `enqueueExpiredFacePurges(database, now)` and `runMaintenance`. It uses the same idempotent D1-first purge outbox as the admin purge route. Operators must still verify a particular job completed before treating provider deletion as complete.

The public `/` and `/contact` showcase pages remain static and public. They do not receive event grants or private cache headers. `/models/*` is immutable public model delivery, while face-search POST responses are always `private, no-store` even for public events.

## Privacy and access boundary

The visitor explicitly consents before choosing or capturing an image. The image remains a browser `ImageBitmap`; it is never included in an API request. YuNet detects candidate faces locally, the visitor selects the intended face, and SFace produces exactly 128 finite, L2-normalized values. Only that embedding is submitted.

The Worker independently checks event publication, protected-event grant/version, face-search opt-in, and whether an active generation remains before querying Vectorize. During the short interval between an individual expiry and its scheduled provider purge, Vectorize may still return that vector; the D1 result join filters it out before any response is built. Search never creates a grant. Responses contain photo IDs, revisioned thumbnail URLs, moments, timestamps, and bounded cosine scores; they never contain embeddings, face coordinates, vector IDs, or identity claims. UI copy consistently says “possible matches” and “nearby moment.”

Vectorize namespaces are `face:{eventId}:generation:{generation}`. Only `partition_id` must be configured as an indexed metadata field. Queries initially use `topK=100`; a saturated result enables signed partition fan-out. Cursor HMAC material is domain-separated from `TURNSTILE_SECRET_KEY`; the feature fails closed when it is unavailable. Matches below cosine `0.363` are discarded. Every Vectorize query adds 128 to `vector_dimensions_queried`.

## Indexing and retention

D1 remains authoritative. Face/vector IDs are deterministic for retry safety, natural face keys are idempotent, and a retry does not consume quota again. Partition capacity is conditionally reserved in D1 and cannot exceed 100. A new D1 face reference is recorded before its Vectorize upsert; if the provider call fails, the reference remains in `indexing` state for an idempotent retry instead of leaving an untracked provider vector. Model generation is part of the Vectorize namespace and partition record.

An embedding expiry cannot exceed `startsAt + retentionDays` when event retention is configured. The scheduled path creates a `purge_expired_faces` job per affected event, deletes only vectors at or before the captured cutoff, and then removes the matching D1 rows and repairs partition counts. A manual whole-event purge first disables event search and marks photo face state as deleting, then enqueues `purge_event_faces`. Both provider cleanup paths remain retryable through maintenance.

Photo deletion and face indexing use a D1 state fence: a live indexing lease prevents deletion from capturing an incomplete vector set, while a deleting photo cannot start another indexing pass. Face-row inserts and success/failure transitions must still own the exact lease timestamp. Indexing itself never steals an abandoned lease; deletion may reclaim it after 15 minutes. After every provider upsert, ownership is checked again. A lost owner compensates immediately, or durably queues a `delete_face_vector` job if the provider delete fails. A face expiry is immutable once its provider intent exists; after expiry, purge the old row/vector before re-indexing it with a new expiry. The expiry participates in the deterministic face/vector identity, so a later re-index cannot reuse an ID still referenced by an old cleanup job. If vector IDs exist but `FACE_INDEX` is unavailable, cleanup fails and remains retryable; it is never acknowledged as physically complete.

## Models and deployment

`scripts/models/manifest.json` pins YuNet and SFace byte sizes, SHA-256 hashes, licenses, dimensions, preprocessing, metric, and upload keys. Run:

```powershell
node scripts/models/download.mjs
```

The idempotent script reuses only checksum-valid files and writes `.artifacts/models/upload-manifest.json`. Upload those files to the exact `models/v1/...` keys in `MODELS_BUCKET`. `.artifacts/` is ignored.

The find route dynamically imports `onnxruntime-web`. WASM is the default; WebGPU is opt-in and uses the package's JSPI entry only when both WebGPU and WebAssembly JSPI are available, otherwise it falls back to WASM. This keeps both emitted runtime binaries below Cloudflare's 25 MiB per-static-asset deployment limit; do not switch the WebGPU path back to the larger Asyncify entry without changing the hosting design. Vite resolves and emits the ONNX package WASM assets. Model responses are downloaded once, checked for size and SHA-256, then stored in a versioned browser Cache API cache before session creation. SFace input uses a least-squares affine transform across all five YuNet landmarks.

The build must contain the regular `ort-wasm-simd-threaded` binary and may contain the `jspi` binary, but no emitted static asset may exceed 26,214,400 bytes. WebGPU-capable browsers without JSPI intentionally use WASM; real-device JSPI/WebGPU behavior remains part of the wave-3 validation matrix.

Real iPhone Safari validation of WASM memory behavior, camera capture, model-cache persistence, multi-face selection, and protected-event access remains a required wave-3 release check; desktop automation is not a substitute.
