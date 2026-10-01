-- Preserve catalog identity and media references while expanding framing choices.
ALTER TABLE site_services ADD COLUMN photo_alignment_next TEXT NOT NULL DEFAULT 'center'
  CHECK (photo_alignment_next IN ('left', 'center', 'right', 'top', 'bottom'));
ALTER TABLE site_services ADD COLUMN mobile_photo_alignment_next TEXT DEFAULT NULL
  CHECK (mobile_photo_alignment_next IS NULL OR mobile_photo_alignment_next IN ('left', 'center', 'right', 'top', 'bottom'));
UPDATE site_services SET photo_alignment_next = photo_alignment, mobile_photo_alignment_next = mobile_photo_alignment;
ALTER TABLE site_services DROP COLUMN photo_alignment;
ALTER TABLE site_services DROP COLUMN mobile_photo_alignment;
ALTER TABLE site_services RENAME COLUMN photo_alignment_next TO photo_alignment;
ALTER TABLE site_services RENAME COLUMN mobile_photo_alignment_next TO mobile_photo_alignment;
