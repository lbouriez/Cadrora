-- Unlisted public galleries remain accessible by direct link when the directory is hidden.
DROP TRIGGER gallery_directory_requires_private;
DROP TRIGGER gallery_directory_no_public_republish;

CREATE TRIGGER gallery_directory_requires_private BEFORE UPDATE OF gallery_directory_enabled ON site_settings
WHEN NEW.gallery_directory_enabled = 0 AND EXISTS (
  SELECT 1 FROM events WHERE access = 'public' AND visibility = 'published'
    AND offline_at IS NULL AND deleting_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'public galleries remain');
END;

CREATE TRIGGER gallery_directory_no_public_republish BEFORE UPDATE OF visibility, offline_at ON events
WHEN NEW.access = 'public' AND NEW.visibility = 'published' AND NEW.offline_at IS NULL
  AND NEW.deleting_at IS NULL
  AND (SELECT gallery_directory_enabled FROM site_settings WHERE id = 1) = 0
BEGIN
  SELECT RAISE(ABORT, 'public galleries disabled');
END;
