ALTER TABLE site_settings
  ADD COLUMN analytics_measurement_id TEXT
  CHECK (analytics_measurement_id IS NULL OR analytics_measurement_id GLOB 'G-[A-Z0-9]*');

ALTER TABLE site_settings ADD COLUMN contact_phone TEXT;
ALTER TABLE site_settings ADD COLUMN contact_address TEXT;
ALTER TABLE site_settings ADD COLUMN service_area TEXT;
ALTER TABLE site_settings ADD COLUMN map_center_latitude REAL CHECK (map_center_latitude BETWEEN -90 AND 90);
ALTER TABLE site_settings ADD COLUMN map_center_longitude REAL CHECK (map_center_longitude BETWEEN -180 AND 180);
ALTER TABLE site_settings ADD COLUMN map_radius_km INTEGER CHECK (map_radius_km > 0 AND map_radius_km <= 2000);
ALTER TABLE site_settings ADD COLUMN enabled_services TEXT NOT NULL DEFAULT '["wedding","family","brand","corporate","children"]';
