CREATE TABLE worker_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  route_group TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL
) STRICT;

CREATE INDEX idx_worker_errors_occurred_at ON worker_errors (occurred_at);
