-- Keep the import's original-file choice stable across pause and resume.
ALTER TABLE imports ADD COLUMN keep_originals INTEGER NOT NULL DEFAULT 0 CHECK (keep_originals IN (0, 1));

-- SQLite cannot widen a CHECK constraint in place. Preserve every existing variant.
CREATE TABLE photo_variants_new (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('thumb', 'small', 'medium', 'large', 'download', 'original')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  checksum_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id, variant)
) WITHOUT ROWID, STRICT;

INSERT INTO photo_variants_new
  (photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
SELECT photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at
FROM photo_variants;

DROP TABLE photo_variants;
ALTER TABLE photo_variants_new RENAME TO photo_variants;
CREATE INDEX idx_variants_photo ON photo_variants (photo_id, variant);
