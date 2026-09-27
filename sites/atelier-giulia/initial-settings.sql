-- Apply only to the untouched singleton inserted by migration 002. Owner edits always win.
UPDATE site_settings
SET site_name = 'Atelier Giulia', updated_at = '2026-09-24T00:00:00.000Z'
WHERE id = 1 AND site_name = 'Cadrora' AND updated_at = '2026-09-20T00:00:00.000Z';

-- Restore Atelier Giulia's existing bilingual description and footer on first migration.
-- A saved owner override is never replaced on subsequent deployments.
UPDATE site_settings
SET site_copy = json_object(
  'fr', json_object('description', 'Atelier Giulia, portraits, célébrations et galeries photo.', 'footerTagline', 'Des images pleines de vie.'),
  'en', json_object('description', 'Portrait and celebration photography by Atelier Giulia. Explore our photo galleries.', 'footerTagline', 'Photography with feeling.')
)
WHERE id = 1 AND site_copy IS NULL;

-- Show the temporary notice once, while leaving later owner choices intact.
UPDATE site_settings
SET construction_notice_enabled = 1
WHERE id = 1 AND construction_notice_enabled IS NULL;

-- Correct only the original English seed. Never replace an owner's edited text.
UPDATE site_settings
SET site_copy = json_set(site_copy, '$.en.description', 'Portrait and celebration photography by Atelier Giulia. Explore our photo galleries.'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 1
  AND json_valid(site_copy)
  AND json_extract(site_copy, '$.en.description') = 'Atelier Giulia, portraits, celebrations, and photo galleries.';
