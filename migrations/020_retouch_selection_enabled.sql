-- Existing protected galleries keep their current selection workflow until the owner disables it.
ALTER TABLE events ADD COLUMN retouch_selection_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (retouch_selection_enabled IN (0, 1));
