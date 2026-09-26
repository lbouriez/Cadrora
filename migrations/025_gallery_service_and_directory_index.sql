ALTER TABLE events ADD COLUMN service TEXT
  CHECK (service IS NULL OR service IN (
    'wedding', 'family', 'portrait', 'maternity', 'brand', 'work', 'kids', 'events', 'other'
  ));

CREATE INDEX idx_events_public_directory
  ON events (starts_at DESC, id ASC)
  WHERE visibility = 'published' AND show_on_gallery_page = 1
    AND offline_at IS NULL AND deleting_at IS NULL;
