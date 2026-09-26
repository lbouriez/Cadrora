ALTER TABLE site_settings ADD COLUMN home_galleries_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (home_galleries_enabled IN (0, 1));

ALTER TABLE site_settings ADD COLUMN home_galleries_limit INTEGER NOT NULL DEFAULT 6
  CHECK (home_galleries_limit BETWEEN 1 AND 12);
