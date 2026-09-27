CREATE TABLE portfolio_photos (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES site_services(id),
  alt_json TEXT NOT NULL CHECK (json_valid(alt_json)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_portfolio_photos_service ON portfolio_photos (service_id, sort_order, id);

CREATE TABLE portfolio_variants (
  photo_id TEXT NOT NULL REFERENCES portfolio_photos(id) ON DELETE CASCADE,
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

CREATE TRIGGER portfolio_variant_storage_insert AFTER INSERT ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value + NEW.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TRIGGER portfolio_variant_storage_delete AFTER DELETE ON portfolio_variants
BEGIN
  UPDATE usage_counters SET value = value - OLD.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TABLE maintenance_jobs_v9 (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('delete_face_vector', 'delete_photo_media', 'delete_gallery', 'delete_gallery_originals', 'delete_replaced_media', 'delete_service_media', 'delete_portfolio_media', 'purge_event_faces', 'purge_expired_faces', 'reconcile_usage', 'purge_gallery_cache')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO maintenance_jobs_v9
  (id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at)
SELECT id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at
FROM maintenance_jobs;

DROP TABLE maintenance_jobs;
ALTER TABLE maintenance_jobs_v9 RENAME TO maintenance_jobs;
CREATE INDEX idx_maintenance_jobs_ready ON maintenance_jobs (state, available_at, attempts);
CREATE UNIQUE INDEX idx_original_cleanup_active_gallery
  ON maintenance_jobs (json_extract(payload_json, '$.eventId'))
  WHERE kind = 'delete_gallery_originals' AND state IN ('pending', 'running');
