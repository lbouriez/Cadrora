ALTER TABLE site_settings ADD COLUMN sessions_page_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sessions_page_enabled IN (0, 1));
