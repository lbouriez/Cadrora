ALTER TABLE site_settings ADD COLUMN gallery_directory_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (gallery_directory_enabled IN (0, 1));

CREATE TRIGGER gallery_directory_no_public_insert BEFORE INSERT ON events
WHEN NEW.access = 'public' AND (SELECT gallery_directory_enabled FROM site_settings WHERE id = 1) = 0
BEGIN
  SELECT RAISE(ABORT, 'public galleries disabled');
END;

CREATE TRIGGER gallery_directory_no_public_update BEFORE UPDATE OF access ON events
WHEN NEW.access = 'public' AND (SELECT gallery_directory_enabled FROM site_settings WHERE id = 1) = 0
BEGIN
  SELECT RAISE(ABORT, 'public galleries disabled');
END;

CREATE TRIGGER gallery_directory_requires_private BEFORE UPDATE OF gallery_directory_enabled ON site_settings
WHEN NEW.gallery_directory_enabled = 0 AND EXISTS (
  SELECT 1 FROM events WHERE access = 'public' AND deleting_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'public galleries remain');
END;
