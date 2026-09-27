CREATE TABLE portfolio_categories (
  id TEXT PRIMARY KEY,
  copy_json TEXT NOT NULL CHECK (json_valid(copy_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO portfolio_categories (id, copy_json, created_at, updated_at)
SELECT id, json_object(
  'fr', COALESCE(json_extract(copy_json, '$.fr.title'),
    CASE id WHEN 'wedding' THEN 'Mariage' WHEN 'family' THEN 'Famille'
      WHEN 'brand' THEN 'Marque' WHEN 'corporate' THEN 'Entreprise'
      WHEN 'children' THEN 'Enfance' ELSE id END),
  'en', COALESCE(json_extract(copy_json, '$.en.title'),
    CASE id WHEN 'wedding' THEN 'Wedding' WHEN 'family' THEN 'Family'
      WHEN 'brand' THEN 'Brand' WHEN 'corporate' THEN 'Corporate'
      WHEN 'children' THEN 'Children' ELSE id END)
), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM site_services WHERE id <> 'home-hero';

CREATE TABLE portfolio_collections_next (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL REFERENCES portfolio_categories(id),
  copy_json TEXT NOT NULL CHECK (json_valid(copy_json)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  cover_photo_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO portfolio_collections_next
  (id, slug, category_id, copy_json, sort_order, published, cover_photo_id, created_at, updated_at)
SELECT id, slug, service_id, copy_json, sort_order, published, cover_photo_id, created_at, updated_at
FROM portfolio_collections;

CREATE TABLE portfolio_photos_next (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES portfolio_collections_next(id) ON DELETE CASCADE,
  alt_json TEXT NOT NULL CHECK (json_valid(alt_json)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO portfolio_photos_next
  (id, collection_id, alt_json, sort_order, state, created_at, updated_at)
SELECT id, collection_id, alt_json, sort_order, state, created_at, updated_at
FROM portfolio_photos;

CREATE TABLE portfolio_variants_next (
  photo_id TEXT NOT NULL REFERENCES portfolio_photos_next(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('preview', 'small', 'medium', 'large')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  checksum_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id, variant)
) WITHOUT ROWID, STRICT;

INSERT INTO portfolio_variants_next
  (photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
SELECT photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at
FROM portfolio_variants;

DROP TABLE portfolio_variants;
DROP TABLE portfolio_photos;
DROP TABLE portfolio_collections;
ALTER TABLE portfolio_collections_next RENAME TO portfolio_collections;
ALTER TABLE portfolio_photos_next RENAME TO portfolio_photos;
ALTER TABLE portfolio_variants_next RENAME TO portfolio_variants;

CREATE INDEX idx_portfolio_collections_public ON portfolio_collections (published, sort_order, id);
CREATE INDEX idx_portfolio_photos_collection ON portfolio_photos (collection_id, sort_order, id);

CREATE TRIGGER portfolio_variant_storage_insert AFTER INSERT ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value + NEW.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TRIGGER portfolio_variant_storage_delete AFTER DELETE ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value - OLD.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TRIGGER portfolio_variant_storage_update AFTER UPDATE OF byte_size ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value + NEW.byte_size - OLD.byte_size,
    updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;
