-- Keep the legacy table and error endpoint compatible while adding structured
-- application events. Existing rows remain HTTP errors with no job reference.
ALTER TABLE worker_errors ADD COLUMN level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('info', 'warn', 'error'));
ALTER TABLE worker_errors ADD COLUMN source TEXT NOT NULL DEFAULT 'http' CHECK (source IN ('http', 'maintenance', 'scheduler'));
ALTER TABLE worker_errors ADD COLUMN job_id TEXT;
ALTER TABLE worker_errors ADD COLUMN job_kind TEXT;
CREATE INDEX idx_app_logs_level_id ON worker_errors (level, id DESC);
CREATE INDEX idx_app_logs_source_id ON worker_errors (source, id DESC);

CREATE TABLE maintenance_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('running', 'completed', 'failed')),
  processed INTEGER NOT NULL DEFAULT 0 CHECK (processed >= 0)
) STRICT;
CREATE INDEX idx_maintenance_runs_started ON maintenance_runs (started_at DESC);
CREATE INDEX idx_maintenance_runs_success ON maintenance_runs (state, finished_at DESC);
CREATE INDEX idx_maintenance_jobs_history ON maintenance_jobs (created_at DESC, id DESC);
CREATE INDEX idx_maintenance_jobs_state_history ON maintenance_jobs (state, created_at DESC, id DESC);
