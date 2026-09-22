ALTER TABLE site_settings
  ADD COLUMN owner_gallery_limit INTEGER
  CHECK (owner_gallery_limit IS NULL OR owner_gallery_limit > 0);

ALTER TABLE site_settings
  ADD COLUMN owner_storage_limit_bytes INTEGER
  CHECK (owner_storage_limit_bytes IS NULL OR owner_storage_limit_bytes > 0);

ALTER TABLE site_settings
  ADD COLUMN owner_face_limit INTEGER
  CHECK (owner_face_limit IS NULL OR owner_face_limit > 0);
