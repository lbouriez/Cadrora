ALTER TABLE events ADD COLUMN show_on_gallery_page INTEGER NOT NULL DEFAULT 1
  CHECK (show_on_gallery_page IN (0, 1));
