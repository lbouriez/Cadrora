-- Framing metadata only; published image variants remain unchanged.
ALTER TABLE site_services ADD COLUMN photo_alignment TEXT NOT NULL DEFAULT 'center'
  CHECK (photo_alignment IN ('left', 'center', 'right'));
ALTER TABLE site_services ADD COLUMN mobile_photo_alignment TEXT DEFAULT NULL
  CHECK (mobile_photo_alignment IS NULL OR mobile_photo_alignment IN ('left', 'center', 'right'));
