# Optional demonstration content

These WebP files are original, AI-generated demonstration images created for Cadrora. They do not depict real clients and are not part of the static website build. When `CADRORA_SEED_DEMO=true`, the release script uploads them to the deployment's private `MEDIA_BUCKET` and applies the idempotent D1 records in `demo.sql` before deploying the Worker.

The public sample gallery is `lumiere-et-promesses`. The protected sample is `instants-en-famille`, with the deliberately public disposable password `cadrora-demo`. Disable demo seeding for a real photographer deployment and replace the template public profile values before launch.
