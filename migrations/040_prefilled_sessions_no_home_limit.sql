-- Add editable built-in examples without changing any existing session choices.
INSERT INTO site_services (id, is_builtin, sort_order, enabled, show_on_home, created_at, updated_at)
SELECT additions.id, 1, base.next_order + additions.offset, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM site_services WHERE id NOT IN ('home-hero', 'about-hero')) AS base
CROSS JOIN (
  SELECT 'maternity' AS id, 0 AS offset
  UNION ALL SELECT 'portrait', 1
  UNION ALL SELECT 'couples', 2
) AS additions;

-- Keep the legacy fallback list aligned with the enabled built-in catalog.
UPDATE site_settings
SET enabled_services = json_insert(enabled_services,
  '$[#]', 'maternity', '$[#]', 'portrait', '$[#]', 'couples')
WHERE id = 1;

-- Home visibility is now controlled solely by each session's show_on_home flag.
ALTER TABLE site_settings DROP COLUMN home_services_limit;
