# ADR-007: Visitor photo selection and client-side batch downloads

- Status: accepted
- Date: 2026-09-23

## Context

The owner can already enable downloads for a gallery and the Worker streams a `download` variant, but visitors cannot select multiple photos. Browsers may block a sequence of automatic file downloads, while constructing a large archive inside a Free-plan Worker would add CPU, memory, and per-object operation pressure. The first-party website must remain usable without an external archive service.

## Decision

- Keep one photo as a direct, authorized `/media/.../download` attachment. The gallery and shared viewer expose a selection control and a themed icon action only when a download variant exists and the owner allows downloads.
- On browsers with `showDirectoryPicker`, let the visitor choose a parent directory and stream each selected photo into a new uniquely named child directory. No existing file is overwritten; no photo body is buffered by the app.
- On other browsers, or by explicit visitor choice, create one ZIP on the visitor device using dynamically imported `@zip.js/zip.js` version 2.17.0 (BSD-3-Clause). The archive stores already-compressed JPEG/WebP entries without recompression. Bound this memory-backed fallback to 100 photos and 250 decimal MB; larger selections require smaller batches or a browser with directory access. The finished ZIP is offered as a normal user-clicked download link.
- Do not add a Worker ZIP endpoint, public R2 bucket, external service, or persistent selection state. Each media request is reauthorized by the Worker. `original` variants, if ever present, obey the same gallery download flag as `download` variants.
- In the official opt-in showcase, make five AI-gallery photos downloadable using separate private R2 objects derived from the tracked generated WebP assets. Real imports continue to produce metadata-stripped JPEG download variants up to 3840 px.

## Consequences

Desktop browsers with directory access deliver separate image files without triggering the browser's multiple-automatic-download permission. The portable ZIP fallback adds a lazy client bundle and can use substantial device memory, so its limits and progress must be visible. Mobile browsers without directory access receive an archive for multi-photo selections. A visitor can still save any displayed image through browser tools: the owner flag controls the official high-quality download path, not DRM or already cached copies.

Adding the dependency requires a package-lock change and the repository's full check, test, build, audit, and browser validation. Protected galleries, offline galleries, disabled downloads, absent variants, partial failures, and both language resources require coverage.
