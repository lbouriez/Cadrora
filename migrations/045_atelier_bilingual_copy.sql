-- Copy-only corrections for the maintained Atelier Giulia installation.
-- The site name and public email identify that installation; each exact-value
-- check preserves any owner edits made after this text was reviewed.
UPDATE site_settings
SET about_copy = json_set(about_copy, '$.en.body', 'I''m Giulia, an Italian photographer living in Canada with a passion for family photography. I''ve always been the one grabbing the camera to capture happy moments — with a keen eye for aesthetics and, above all, making people feel at ease in front of the lens.'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com'
  AND json_valid(about_copy)
  AND json_extract(about_copy, '$.en.body') = 'I''m Giulia, an Italian girl who moved to Canada with a passion for family photography. I''ve always been the one grabbing the camera to capture happy moments — with a keen eye for aesthetics and, above all, making people feel at ease in front of the lens.';

UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.en.shortDescription', CASE WHEN json_extract(copy_json, '$.en.shortDescription') = 'The beauty of becoming'
        THEN 'The beauty of becoming a mother' ELSE json_extract(copy_json, '$.en.shortDescription') END,
      '$.en.description', CASE WHEN json_extract(copy_json, '$.en.description') = 'The beauty of becoming'
        THEN 'The beauty of becoming a mother' ELSE json_extract(copy_json, '$.en.description') END),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_valid(copy_json)
  AND (json_extract(copy_json, '$.en.shortDescription') = 'The beauty of becoming'
    OR json_extract(copy_json, '$.en.description') = 'The beauty of becoming')
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.fr.shortDescription', CASE WHEN json_extract(copy_json, '$.fr.shortDescription') = 'Love and laugh'
        THEN 'De l’amour et des rires' ELSE json_extract(copy_json, '$.fr.shortDescription') END,
      '$.fr.description', CASE WHEN json_extract(copy_json, '$.fr.description') = 'Love and laugh'
        THEN 'De l’amour et des rires' ELSE json_extract(copy_json, '$.fr.description') END,
      '$.en.shortDescription', CASE WHEN json_extract(copy_json, '$.en.shortDescription') = 'Love and laugh'
        THEN 'Love and laughter' ELSE json_extract(copy_json, '$.en.shortDescription') END,
      '$.en.description', CASE WHEN json_extract(copy_json, '$.en.description') = 'Love and laugh'
        THEN 'Love and laughter' ELSE json_extract(copy_json, '$.en.description') END),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_valid(copy_json)
  AND (json_extract(copy_json, '$.fr.shortDescription') = 'Love and laugh'
    OR json_extract(copy_json, '$.fr.description') = 'Love and laugh'
    OR json_extract(copy_json, '$.en.shortDescription') = 'Love and laugh'
    OR json_extract(copy_json, '$.en.description') = 'Love and laugh')
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');
