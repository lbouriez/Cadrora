ALTER TABLE site_settings ADD COLUMN about_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (about_enabled IN (0, 1));
ALTER TABLE site_settings ADD COLUMN about_copy TEXT
  CHECK (about_copy IS NULL OR json_valid(about_copy));
ALTER TABLE site_settings ADD COLUMN about_image_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (about_image_enabled IN (0, 1));

-- Reserved media owner uses the same variant, quota, revision and cleanup path
-- as the Home introduction. It never appears in the Sessions catalog.
INSERT INTO site_services (id, is_builtin, sort_order, enabled, show_on_home, created_at, updated_at)
VALUES ('about-hero', 1, 31, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
