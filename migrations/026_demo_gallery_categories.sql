-- Label only the three reserved showcase galleries when no owner category exists.
UPDATE events
SET service = CASE id
      WHEN 'demo-public' THEN 'wedding'
      WHEN 'demo-private' THEN 'family'
      WHEN 'demo-ai-face-search' THEN 'events'
    END,
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE service IS NULL
  AND (
    (id = 'demo-public' AND slug = 'lumiere-et-promesses') OR
    (id = 'demo-private' AND slug = 'instants-en-famille') OR
    (id = 'demo-ai-face-search' AND slug = 'find-your-photos')
  );
