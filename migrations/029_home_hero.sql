ALTER TABLE site_settings ADD COLUMN home_hero_copy TEXT CHECK (home_hero_copy IS NULL OR json_valid(home_hero_copy));
ALTER TABLE site_settings ADD COLUMN home_hero_image_enabled INTEGER NOT NULL DEFAULT 0 CHECK (home_hero_image_enabled IN (0, 1));

-- Reserved media owner: uses the same verified browser variants, quota triggers,
-- revisioned URLs and maintenance cleanup as service-card photos.
INSERT INTO site_services (id, is_builtin, sort_order, enabled, show_on_home, created_at, updated_at)
VALUES ('home-hero', 1, 30, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
