-- Apply only to the untouched singleton inserted by migration 002. Owner edits always win.
UPDATE site_settings
SET site_name = 'Atelier Giulia', updated_at = '2026-09-24T00:00:00.000Z'
WHERE id = 1 AND site_name = 'Cadrora' AND updated_at = '2026-09-20T00:00:00.000Z';
