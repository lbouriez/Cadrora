CREATE TABLE portfolio_collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL REFERENCES site_services(id),
  copy_json TEXT NOT NULL CHECK (json_valid(copy_json)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  cover_photo_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_portfolio_collections_public ON portfolio_collections (published, sort_order, id);

ALTER TABLE portfolio_photos ADD COLUMN collection_id TEXT REFERENCES portfolio_collections(id) ON DELETE CASCADE;

-- Keep photos uploaded with the original per-service editor in a collection.
INSERT INTO portfolio_collections (id, slug, service_id, copy_json, sort_order, published, created_at, updated_at)
SELECT 'legacy-' || p.service_id, 'service-' || p.service_id, p.service_id,
  json_object(
    'fr', json_object('title', COALESCE(json_extract(s.copy_json, '$.fr.title'), p.service_id), 'description', ''),
    'en', json_object('title', COALESCE(json_extract(s.copy_json, '$.en.title'), p.service_id), 'description', '')
  ), s.sort_order, MAX(CASE WHEN p.state = 'published' THEN 1 ELSE 0 END), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM portfolio_photos p JOIN site_services s ON s.id = p.service_id
GROUP BY p.service_id;

UPDATE portfolio_photos SET collection_id = 'legacy-' || service_id WHERE collection_id IS NULL;
CREATE INDEX idx_portfolio_photos_collection ON portfolio_photos (collection_id, sort_order, id);

CREATE TRIGGER portfolio_variant_storage_update AFTER UPDATE OF byte_size ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value + NEW.byte_size - OLD.byte_size,
    updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;
