# Browser import pipeline

Package PC keeps all image decode and re-encoding in the photographer browser. The Worker receives only declared photo records and already-encoded JPEG/WebP variant bytes; it never decodes source files.

## Import sequence

1. The browser validates JPEG, PNG, or WebP bytes and verifies decoding. For JPEG it safely reads orientation, `DateTimeOriginal`, and optional `OffsetTimeOriginal`; a missing offset is interpreted in the gallery timezone. Invalid capture values remain `null`—upload time and `File.lastModified` are never substituted. Corrupt or unsupported files are reported locally and never declared.
2. A client-generated import ID is journaled with structured-cloneable source files in IndexedDB before the idempotent `POST /api/v1/admin/galleries/:eventId/imports` request.
3. Each next unfinished chunk contains at most 50 declarations and is atomically upserted through `POST /api/v1/admin/imports/:importId/photos`.
4. The image worker decodes with `imageOrientation: 'none'`, applies exactly one of the eight EXIF transforms, draws to a new canvas, and re-encodes. This pixel-only path removes source EXIF/XMP metadata including GPS, serial, and comment fields. Only the normalized capture instant from preflight is carried separately in the declaration.
5. Widths 480, 960, 1600, and 2560 prefer WebP only if both the Blob MIME and magic bytes verify. They fall back to JPEG. The 3840 download variant is always JPEG. No variant is upscaled.
   When downloads and **Offer original files** are enabled, the import records that choice in D1 and its browser journal, then uploads the unchanged source JPEG, PNG, or WebP (at most 100 MB) as a sixth, optional object. It is not sent through the image worker and retains EXIF/XMP metadata. The Worker checks source MIME/dimensions against the declared photo and verifies the R2 checksum and byte count.
6. At most two photo encodes and three variant uploads run concurrently. Every binary upload has dimensions, declared size, checksum, and MIME checked again by the Worker. The Worker inspects only the MIME magic-byte prefix, then pipes the reconstructed body through `FixedLengthStream(declaredByteSize)` to restore the known length required by R2 `put`; R2 checks SHA-256 and the Worker verifies the completed object's byte size before recording it in D1. An ordinary `ReadableStream` is insufficient here even when the original request body had a known length.
7. A photo finalizes only after all five variants exist, plus the original when the import opted in. Resume reads the next non-finalized IndexedDB chunk and preserves the original choice; natural IDs make repeated declarations, uploads, and finalization safe. Cancel also marks the server import cancelled; subsequent variant uploads are rejected, including an in-flight R2 upload that completes after cancellation.

## Integration

The root Worker registers `registerAdminImportRoutes` from `src/server/routes/admin/imports.ts` after global admin authorization middleware. The SPA mounts `ImportPage` under the authorized `/admin/galleries/:eventId/import` route. Keep all future import routes behind the same Worker-admin and Origin-CSRF checks.

`adminImportResources` from `src/app/admin/ImportResources.ts` must be merged into the root i18next resources before the screen is mounted. The package does not own public `/` or `/contact` routes.

## Limits and recovery

The Worker rejects import declarations over `MAX_PHOTOS_PER_EVENT` and media uploads over `MAX_STORAGE_BYTES`. It fails closed if either binding is invalid. A stopped upload leaves an idempotent partial object at its derived key and an unfinished journal chunk; it is safe to resume. Cancelling stops browser work and retains no publishable photo state.

The browser retains the request's API error code (not its arbitrary message) so the UI can distinguish an expired admin session, an unavailable gallery, and the per-gallery photo limit in both languages. A failure before the server creates an import leaves a paused local journal: **Resume** retries the same idempotent ID and **Cancel** uses the already-selected durable job instead of rereading it, then may complete locally if the server returns `IMPORT_NOT_FOUND`. Do not turn an unknown request failure into a claim that upload succeeded. When diagnosing a 0-photo failure, check whether an `imports` row exists in the instance's D1 before inspecting R2; never ask an owner to discard the local journal first.

An unsuccessful Cancel shows a distinct localized message and retains the journal. Its browser-console diagnostic contains only the operation, error category, and typed API status/code if present; it never logs exception text, filenames, photos, or credentials.

The production `FetchImportApi` uses a wrapper around the browser's global `fetch`. Do not store native `fetch` directly and invoke it as a class method: some browsers reject the foreign receiver with a `TypeError` before a request reaches the Worker. This affects both import creation and cancellation.

## Acceptance coverage

`tests/unit/app/importPipeline.test.ts` exercises the real `ImportPipeline` orchestration with deterministic browser/provider fakes. It processes a 200-file journal as exactly four ordered declarations of 50 photos. A second scenario imports the tracked fictional `nearby-amelia-exif.jpg` fixture and verifies its `DateTimeOriginal`/`OffsetTimeOriginal` becomes `2026-08-30T18:02:00.000Z` in the server declaration. A resume scenario interrupts declaration of chunk 2 after 100 finalized photos, constructs a fresh pipeline over the same durable journal, and verifies that only chunks 2 and 3 are encoded and declared during resume.

`tests/e2e/admin-import.spec.ts` seeds the browser's real IndexedDB with 200 file records and four 50-photo chunks, of which the first two are finalized. The visible resume action must report `100/200` and issue the next declaration for chunk 2 with 50 photos. Its network boundary is intentionally mocked to stop before bulk encoding/upload; this validates browser persistence, route integration, and observable resume behavior, not D1, R2, or a real provider-backed 200-photo transfer.

`tests/unit/server/adminImportRoutes.test.ts` models R2's known-length-stream requirement on variant upload. Do not replace this with a permissive fake bucket: it missed a production-only 500 after successful D1 photo declaration.

Before release, still run a real browser exercise with representative photo sizes against preview bindings, interrupt the tab during transfer, and confirm final D1/R2 state after resume. Local deterministic coverage catches chunk and checkpoint regressions but does not replace that operational acceptance test.
