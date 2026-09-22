ALTER TABLE site_settings
  ADD COLUMN enabled_languages TEXT NOT NULL DEFAULT '["fr","en"]'
  CHECK (json_valid(enabled_languages) AND json_type(enabled_languages) = 'array');
