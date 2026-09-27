-- Seed a new standalone site only while the migration-002 singleton is untouched.
UPDATE site_settings
SET site_name = 'Studio photo', updated_at = '2026-09-26T00:00:00.000Z'
WHERE id = 1 AND site_name = 'Cadrora' AND updated_at = '2026-09-20T00:00:00.000Z';

UPDATE site_settings
SET site_copy = json_object(
  'fr', json_object('description', 'Studio photo, portraits et galeries privées.', 'footerTagline', 'Des photographies faites pour durer.'),
  'en', json_object('description', 'Photo studio, portraits and private galleries.', 'footerTagline', 'Photographs made to be remembered.')
)
WHERE id = 1 AND site_copy IS NULL;
