# Test image fixtures

`nearby-amelia-exif.jpg` is derived from Cadrora's fictional, AI-generated `ai-demo-11` showcase image. It contains `DateTimeOriginal=2026:08:30 14:02:00` and `OffsetTimeOriginal=-04:00`, which normalizes to `2026-08-30T18:02:00.000Z`: two minutes after the Amelia match `demo-ai-01` at `18:00 UTC`.

Regenerate it with `node tests/fixtures/generateExifFixture.mjs`. The import tests use the real JPEG APP1/TIFF structure to prove the browser preflight retains this one normalized capture instant while the derived-image path still strips the source EXIF payload.
