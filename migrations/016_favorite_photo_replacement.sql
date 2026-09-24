-- A replacement import stages one edited file before an atomic photo-row swap.
ALTER TABLE imports ADD COLUMN replacement_photo_id TEXT;
ALTER TABLE imports ADD COLUMN replacement_applied_at TEXT;
ALTER TABLE photos ADD COLUMN selected_for_retouch INTEGER NOT NULL DEFAULT 0 CHECK (selected_for_retouch IN (0, 1));
CREATE INDEX idx_photos_retouch_selection ON photos (event_id, selected_for_retouch, state, sort_key);

CREATE TABLE maintenance_jobs_v6 (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('delete_face_vector', 'delete_photo_media', 'delete_gallery', 'delete_gallery_originals', 'delete_replaced_media', 'purge_event_faces', 'purge_expired_faces', 'reconcile_usage')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO maintenance_jobs_v6
  (id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at)
SELECT id, kind, state, payload_json, idempotency_key, attempts, available_at, last_error, created_at, updated_at
FROM maintenance_jobs;

DROP TABLE maintenance_jobs;
ALTER TABLE maintenance_jobs_v6 RENAME TO maintenance_jobs;
CREATE INDEX idx_maintenance_jobs_ready ON maintenance_jobs (state, available_at, attempts);
CREATE UNIQUE INDEX idx_original_cleanup_active_gallery
  ON maintenance_jobs (json_extract(payload_json, '$.eventId'))
  WHERE kind = 'delete_gallery_originals' AND state IN ('pending', 'running');
CREATE INDEX idx_import_replacement ON imports (event_id, replacement_photo_id, state);
CREATE UNIQUE INDEX idx_active_photo_replacement ON imports (replacement_photo_id)
  WHERE replacement_photo_id IS NOT NULL AND replacement_applied_at IS NULL AND state != 'cancelled';
