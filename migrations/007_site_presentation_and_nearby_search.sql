PRAGMA foreign_keys = ON;

CREATE TABLE site_settings_next (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL,
  default_language TEXT NOT NULL CHECK (default_language IN ('fr', 'en')),
  contact_email TEXT,
  updated_at TEXT NOT NULL,
  theme_mode TEXT NOT NULL DEFAULT 'both'
    CHECK (theme_mode IN ('light', 'dark', 'both', 'system'))
) STRICT;

INSERT INTO site_settings_next (
  id, site_name, default_language, contact_email, updated_at, theme_mode
)
SELECT id, site_name, default_language, contact_email, updated_at, theme_mode
FROM site_settings;

DROP TABLE site_settings;
ALTER TABLE site_settings_next RENAME TO site_settings;

ALTER TABLE events
  ADD COLUMN nearby_search_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (nearby_search_enabled IN (0, 1));

UPDATE events
SET nearby_search_enabled = face_search_enabled;
