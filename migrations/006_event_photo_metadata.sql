ALTER TABLE events
  ADD COLUMN show_photo_metadata INTEGER NOT NULL DEFAULT 0
  CHECK (show_photo_metadata IN (0, 1));
