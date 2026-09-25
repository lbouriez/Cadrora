-- Existing photos intentionally remain NULL: only future ordinary imports are deduplicated.
ALTER TABLE photos ADD COLUMN source_sha256 TEXT;
CREATE UNIQUE INDEX idx_photos_gallery_source_sha256
  ON photos(event_id, source_sha256)
  WHERE source_sha256 IS NOT NULL AND state NOT IN ('deleting', 'deleted');
