ALTER TABLE events ADD COLUMN deleting_at TEXT;

CREATE TABLE maintenance_jobs_v4 (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('delete_face_vector', 'delete_photo_media', 'delete_gallery', 'purge_event_faces', 'purge_expired_faces', 'reconcile_usage')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO maintenance_jobs_v4 (
  id, kind, state, payload_json, idempotency_key, attempts,
  available_at, last_error, created_at, updated_at
)
SELECT id, kind, state, payload_json, idempotency_key, attempts,
       available_at, last_error, created_at, updated_at
FROM maintenance_jobs;

DROP TABLE maintenance_jobs;
ALTER TABLE maintenance_jobs_v4 RENAME TO maintenance_jobs;

CREATE INDEX idx_maintenance_jobs_ready
  ON maintenance_jobs (state, available_at, attempts);
