ALTER TABLE site_settings ADD COLUMN home_services_limit INTEGER NOT NULL DEFAULT 3
  CHECK (home_services_limit BETWEEN 1 AND 12);

CREATE TABLE site_services (
  id TEXT PRIMARY KEY,
  is_builtin INTEGER NOT NULL CHECK (is_builtin IN (0, 1)),
  sort_order INTEGER NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  show_on_home INTEGER NOT NULL CHECK (show_on_home IN (0, 1)),
  copy_json TEXT CHECK (copy_json IS NULL OR json_valid(copy_json)),
  image_revision INTEGER NOT NULL DEFAULT 0 CHECK (image_revision >= 0),
  pending_image_revision INTEGER CHECK (pending_image_revision IS NULL OR pending_image_revision > image_revision),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE site_service_variants (
  service_id TEXT NOT NULL REFERENCES site_services(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  variant TEXT NOT NULL CHECK (variant IN ('preview', 'small', 'medium', 'large')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  checksum_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (service_id, revision, variant)
) WITHOUT ROWID, STRICT;

INSERT INTO site_services (id, is_builtin, sort_order, enabled, show_on_home, created_at, updated_at)
SELECT keys.id, 1, keys.sort_order,
  EXISTS (SELECT 1 FROM json_each(site_settings.enabled_services) WHERE value = keys.id),
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM site_settings CROSS JOIN (
  SELECT 'wedding' AS id, 0 AS sort_order UNION ALL SELECT 'family', 1
  UNION ALL SELECT 'brand', 2 UNION ALL SELECT 'corporate', 3 UNION ALL SELECT 'children', 4
) AS keys WHERE site_settings.id = 1;

CREATE TRIGGER site_service_variants_storage_insert AFTER INSERT ON site_service_variants
BEGIN
  UPDATE usage_counters SET value = value + NEW.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TRIGGER site_service_variants_storage_delete AFTER DELETE ON site_service_variants
BEGIN
  UPDATE usage_counters SET value = value - OLD.byte_size, updated_at = CURRENT_TIMESTAMP WHERE key = 'storage_bytes';
END;

CREATE TABLE maintenance_jobs_v8 (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('delete_face_vector', 'delete_photo_media', 'delete_gallery', 'delete_gallery_originals', 'delete_replaced_media', 'delete_service_media', 'purge_event_faces', 'purge_expired_faces', 'reconcile_usage', 'purge_gallery_cache')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO maintenance_jobs_v8
  (id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at)
SELECT id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at
FROM maintenance_jobs;

DROP TABLE maintenance_jobs;
ALTER TABLE maintenance_jobs_v8 RENAME TO maintenance_jobs;
CREATE INDEX idx_maintenance_jobs_ready ON maintenance_jobs (state, available_at, attempts);
CREATE UNIQUE INDEX idx_original_cleanup_active_gallery
  ON maintenance_jobs (json_extract(payload_json, '$.eventId'))
  WHERE kind = 'delete_gallery_originals' AND state IN ('pending', 'running');
