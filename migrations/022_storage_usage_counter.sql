-- Seed the authoritative media total once, then maintain it transactionally for
-- every insert, replacement, and delete, including foreign-key cascades.
INSERT INTO usage_counters (key, value, updated_at)
SELECT 'storage_bytes', COALESCE(SUM(byte_size), 0), CURRENT_TIMESTAMP
FROM photo_variants
WHERE 1
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;

CREATE TRIGGER photo_variants_storage_insert
AFTER INSERT ON photo_variants
BEGIN
  UPDATE usage_counters
  SET value = value + NEW.byte_size, updated_at = CURRENT_TIMESTAMP
  WHERE key = 'storage_bytes';
END;

CREATE TRIGGER photo_variants_storage_update
AFTER UPDATE OF byte_size ON photo_variants
WHEN NEW.byte_size != OLD.byte_size
BEGIN
  UPDATE usage_counters
  SET value = value + NEW.byte_size - OLD.byte_size, updated_at = CURRENT_TIMESTAMP
  WHERE key = 'storage_bytes';
END;

CREATE TRIGGER photo_variants_storage_delete
AFTER DELETE ON photo_variants
BEGIN
  UPDATE usage_counters
  SET value = value - OLD.byte_size, updated_at = CURRENT_TIMESTAMP
  WHERE key = 'storage_bytes';
END;
