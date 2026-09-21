ALTER TABLE site_settings
  ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'both'
  CHECK (theme_mode IN ('light', 'dark', 'both'));
