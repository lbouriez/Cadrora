-- Owner-editable bilingual marketing copy. NULL preserves each compiled profile as fallback.
ALTER TABLE site_settings ADD COLUMN site_copy TEXT
  CHECK (site_copy IS NULL OR json_valid(site_copy));
