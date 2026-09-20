PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL,
  default_language TEXT NOT NULL CHECK (default_language IN ('fr', 'en')),
  contact_email TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  cover_photo_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('draft', 'published', 'unlisted')),
  access TEXT NOT NULL CHECK (access IN ('public', 'protected')),
  allow_downloads INTEGER NOT NULL DEFAULT 0 CHECK (allow_downloads IN (0, 1)),
  face_search_enabled INTEGER NOT NULL DEFAULT 0 CHECK (face_search_enabled IN (0, 1)),
  keep_originals INTEGER NOT NULL DEFAULT 0 CHECK (keep_originals IN (0, 1)),
  retention_days INTEGER CHECK (retention_days IS NULL OR retention_days > 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS event_credentials (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  access_version INTEGER NOT NULL DEFAULT 1 CHECK (access_version > 0),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('pending', 'processing', 'paused', 'completed', 'cancelled', 'failed')),
  total_photos INTEGER NOT NULL DEFAULT 0 CHECK (total_photos >= 0),
  completed_photos INTEGER NOT NULL DEFAULT 0 CHECK (completed_photos >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  captured_at TEXT,
  moment_id TEXT,
  sort_key TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state TEXT NOT NULL CHECK (state IN ('pending', 'variants_ready', 'published', 'deleting', 'deleted')),
  face_state TEXT NOT NULL DEFAULT 'disabled' CHECK (face_state IN ('disabled', 'pending', 'indexing', 'ready', 'expired', 'deleting', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, sort_key, id)
) STRICT;

CREATE TABLE IF NOT EXISTS photo_variants (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('thumb', 'small', 'medium', 'large', 'download', 'original')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  checksum_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (photo_id, variant)
) WITHOUT ROWID, STRICT;

CREATE TABLE IF NOT EXISTS import_chunks (
  import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL CHECK (chunk_number >= 0),
  state TEXT NOT NULL CHECK (state IN ('pending', 'uploading', 'finalized', 'failed')),
  photo_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(photo_ids_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (import_id, chunk_number)
) WITHOUT ROWID, STRICT;

CREATE TABLE IF NOT EXISTS face_partitions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL CHECK (generation >= 0),
  partition_number INTEGER NOT NULL CHECK (partition_number >= 0),
  face_count INTEGER NOT NULL DEFAULT 0 CHECK (face_count BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  UNIQUE (event_id, generation, partition_number)
) STRICT;

CREATE TABLE IF NOT EXISTS faces (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  face_number INTEGER NOT NULL CHECK (face_number >= 0),
  partition_id TEXT NOT NULL REFERENCES face_partitions(id) ON DELETE CASCADE,
  vector_id TEXT NOT NULL UNIQUE,
  model_id TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (photo_id, face_number, model_id)
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('password', 'cloudflare-access')),
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS maintenance_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('delete_photo_media', 'purge_event_faces', 'reconcile_usage')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS usage_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at TEXT NOT NULL
) WITHOUT ROWID, STRICT;

CREATE INDEX IF NOT EXISTS idx_events_visibility_starts_at
  ON events (visibility, starts_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_imports_event_state
  ON imports (event_id, state, created_at);
CREATE INDEX IF NOT EXISTS idx_photos_event_state_sort
  ON photos (event_id, state, sort_key, id);
CREATE INDEX IF NOT EXISTS idx_photos_import
  ON photos (import_id, id);
CREATE INDEX IF NOT EXISTS idx_variants_photo
  ON photo_variants (photo_id, variant);
CREATE INDEX IF NOT EXISTS idx_face_partitions_event_generation
  ON face_partitions (event_id, generation, partition_number);
CREATE INDEX IF NOT EXISTS idx_faces_event_partition
  ON faces (event_id, partition_id, id);
CREATE INDEX IF NOT EXISTS idx_faces_expiration
  ON faces (expires_at, id) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token_active
  ON sessions (token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_ready
  ON maintenance_jobs (state, available_at, attempts);

