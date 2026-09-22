# Image pipeline guide

Cadrora processes original images in the photographer’s browser. The Worker receives declared metadata and derived JPEG/WebP bytes; it does not decode original camera files.

## Accepted source files

Version 1 accepts only decodable JPEG, PNG, and WebP. The browser checks magic bytes and uses `createImageBitmap` to reject corrupt input. RAW, HEIC, video, and arbitrary image MIME types are out of scope.

For JPEG, the browser reads only EXIF orientation, decodes with `imageOrientation: 'none'`, then applies exactly one of the eight orientation transforms while drawing fresh pixels. This produces a new encoded file without copied EXIF/XMP metadata. GPS, serial numbers, comments, and other source metadata are not uploaded as part of the variant path.

## Variants

Each finalizable photo has these non-upscaled derivatives:

| Variant | Maximum width | Encoding behavior |
| --- | ---: | --- |
| `thumb` | 480 | Prefer verified WebP; fall back to JPEG |
| `small` | 960 | Prefer verified WebP; fall back to JPEG |
| `medium` | 1600 | Prefer verified WebP; fall back to JPEG |
| `large` | 2560 | Prefer verified WebP; fall back to JPEG |
| `download` | 3840 | JPEG only |

The browser checks both Blob MIME and resulting magic bytes before accepting WebP. The Worker independently checks uploaded MIME, byte size, dimensions, SHA-256, and derived object key before storing its metadata.

## Resuming safely

The browser generates import and photo IDs, stores source `File` objects and chunk state in IndexedDB, and declares chunks of no more than 50 photos. Encoding concurrency is two photos; variant-upload concurrency is three. Replaying the same import ID, chunk number, and ordered photo IDs is safe. Reusing either ID with changed data is rejected.

Cancelling stops browser work. It does not create a publishable photo state. A stopped upload may leave an R2 object at its deterministic key, but a photo cannot be finalized or published without D1 metadata for all required variants.

## Operator limits

`MAX_PHOTOS_PER_EVENT` and `MAX_STORAGE_BYTES` are application guardrails, not Cloudflare billing controls. The checked-in storage ceiling is 9.9 decimal GB (`9900000000` bytes), leaving about 100 MB of the account-level R2 Free allowance for the model bucket and overhead when Cadrora is the only deployment in that account. The owner may select a lower media limit in Site settings. Provider operations and pooled account usage remain separate, and an invalid limit binding fails import requests closed with a configuration error.

## Current integration status

The server import routes are registered by `src/server/app.ts`. The SPA mounts browser import at `/admin/galleries/:eventId/import` behind the admin session route. Validate a resumed import, a corrupted file, each EXIF orientation, a WebP fallback, and quota handling against a dedicated test event before enabling it for operators; source and unit-test evidence do not prove an operator’s browser, storage binding, or deployed quota behavior.

See [`technical/browser-import.md`](technical/browser-import.md) for the code-level contract and [`admin-guide.md`](admin-guide.md) for the required server sequence.
