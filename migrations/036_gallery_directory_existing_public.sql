-- Draft and offline public galleries do not block hiding the directory.
DROP TRIGGER gallery_directory_requires_private;
DROP TRIGGER gallery_directory_no_public_update;

CREATE TRIGGER gallery_directory_requires_private BEFORE UPDATE OF gallery_directory_enabled ON site_settings
WHEN NEW.gallery_directory_enabled = 0 AND EXISTS (
  SELECT 1 FROM events WHERE access = 'public' AND visibility != 'draft'
    AND offline_at IS NULL AND deleting_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'public galleries remain');
END;

CREATE TRIGGER gallery_directory_no_public_update BEFORE UPDATE OF access ON events
WHEN OLD.access <> 'public' AND NEW.access = 'public'
  AND (SELECT gallery_directory_enabled FROM site_settings WHERE id = 1) = 0
BEGIN
  SELECT RAISE(ABORT, 'public galleries disabled');
END;

CREATE TRIGGER gallery_directory_no_public_republish BEFORE UPDATE OF visibility, offline_at ON events
WHEN NEW.access = 'public' AND NEW.visibility != 'draft' AND NEW.offline_at IS NULL
  AND NEW.deleting_at IS NULL
  AND (SELECT gallery_directory_enabled FROM site_settings WHERE id = 1) = 0
BEGIN
  SELECT RAISE(ABORT, 'public galleries disabled');
END;
