-- Apply only to the untouched singleton inserted by migration 002. Owner edits always win.
UPDATE site_settings
SET site_name = 'Atelier Giulia', updated_at = '2026-09-24T00:00:00.000Z'
WHERE id = 1 AND site_name = 'Cadrora' AND updated_at = '2026-09-20T00:00:00.000Z';

-- Restore Atelier Giulia's existing bilingual description and footer on first migration.
-- A saved owner override is never replaced on subsequent deployments.
UPDATE site_settings
SET site_copy = json_object(
  'fr', json_object('description', 'Atelier Giulia, portraits, célébrations et galeries photo.', 'footerTagline', 'Des images pleines de vie.'),
  'en', json_object('description', 'Atelier Giulia, portraits, celebrations, and photo galleries.', 'footerTagline', 'Photography with feeling.')
)
WHERE id = 1 AND site_copy IS NULL;
