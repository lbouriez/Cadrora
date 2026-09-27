-- NULL means the instance profile has not supplied its initial value yet.
ALTER TABLE site_settings ADD COLUMN construction_notice_enabled INTEGER
  CHECK (construction_notice_enabled IN (0, 1));
