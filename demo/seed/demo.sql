PRAGMA foreign_keys = ON;

INSERT INTO events (
  id, slug, title, description, starts_at, timezone, cover_photo_id,
  visibility, access, allow_downloads, face_search_enabled, keep_originals,
  retention_days, revision, created_at, updated_at
) VALUES
  (
    'demo-public', 'lumiere-et-promesses', 'Lumière et promesses',
    'Une célébration d''été racontée avec naturel, de la cérémonie jusqu''aux éclats de rire sur la piste de danse. Contenu entièrement généré pour la démonstration Cadrora.',
    '2026-06-14T20:00:00.000Z', 'America/Toronto', 'demo-public-ceremony',
    'published', 'public', 0, 0, 0, 365, 1,
    '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'
  ),
  (
    'demo-private', 'instants-en-famille', 'Instants en famille',
    'Galerie privée de démonstration — mot de passe : cadrora-demo. Les personnes présentées sont générées et ne sont pas de vrais clients.',
    '2026-10-04T15:00:00.000Z', 'America/Toronto', 'demo-private-family',
    'published', 'protected', 0, 0, 0, 90, 1,
    '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'
  )
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  starts_at = excluded.starts_at,
  timezone = excluded.timezone,
  cover_photo_id = excluded.cover_photo_id,
  visibility = excluded.visibility,
  access = excluded.access,
  allow_downloads = excluded.allow_downloads,
  face_search_enabled = excluded.face_search_enabled,
  keep_originals = excluded.keep_originals,
  retention_days = excluded.retention_days,
  revision = excluded.revision,
  updated_at = excluded.updated_at;

INSERT INTO event_credentials (event_id, password_hash, access_version, updated_at)
VALUES (
  'demo-private',
  'pbkdf2-sha256$600000$7vgSh0keQcI2CR5mNCkChg$2XNowDScabS_ody0CFquhZfHX33RCrLEMh41GYrVGbk',
  1,
  '2026-09-20T00:00:00.000Z'
)
ON CONFLICT(event_id) DO UPDATE SET
  password_hash = excluded.password_hash,
  access_version = excluded.access_version,
  updated_at = excluded.updated_at;

INSERT INTO imports (
  id, event_id, state, total_photos, completed_photos, created_at, updated_at
) VALUES
  ('demo-public-import', 'demo-public', 'completed', 2, 2, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-private-import', 'demo-private', 'completed', 2, 2, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  event_id = excluded.event_id,
  state = excluded.state,
  total_photos = excluded.total_photos,
  completed_photos = excluded.completed_photos,
  updated_at = excluded.updated_at;

INSERT INTO photos (
  id, event_id, import_id, filename, content_type, width, height, captured_at,
  moment_id, sort_key, revision, state, face_state, created_at, updated_at
) VALUES
  ('demo-public-ceremony', 'demo-public', 'demo-public-import', 'ceremonie.webp', 'image/webp', 1536, 1024, '2026-06-14T20:00:00.000Z', NULL, '001', 1, 'published', 'disabled', '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-public-dance', 'demo-public', 'demo-public-import', 'danse.webp', 'image/webp', 1536, 1024, '2026-06-15T01:00:00.000Z', NULL, '002', 1, 'published', 'disabled', '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-private-family', 'demo-private', 'demo-private-import', 'famille-automne.webp', 'image/webp', 1536, 1024, '2026-10-04T15:00:00.000Z', NULL, '001', 1, 'published', 'disabled', '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-private-newborn', 'demo-private', 'demo-private-import', 'nouveau-ne.webp', 'image/webp', 1536, 1024, '2026-10-04T16:00:00.000Z', NULL, '002', 1, 'published', 'disabled', '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  event_id = excluded.event_id,
  import_id = excluded.import_id,
  filename = excluded.filename,
  content_type = excluded.content_type,
  width = excluded.width,
  height = excluded.height,
  captured_at = excluded.captured_at,
  moment_id = excluded.moment_id,
  sort_key = excluded.sort_key,
  revision = excluded.revision,
  state = excluded.state,
  face_state = excluded.face_state,
  updated_at = excluded.updated_at;

INSERT INTO photo_variants (
  photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at
) VALUES
  ('demo-public-dance', 'thumb', 'demo/public/dance/1/thumb.webp', 'image/webp', 23302, 480, 320, '5062efefcf1003cbd8e56a97671708ccfa945dddb9a6a131406fdec360975167', '2026-09-20T00:00:00.000Z'),
  ('demo-public-dance', 'medium', 'demo/public/dance/1/medium.webp', 'image/webp', 55196, 960, 640, 'd23ad9869b66cde6d97dfb7a4846b2865945599d1d6eb3fe3bb2b0d7ce013bdd', '2026-09-20T00:00:00.000Z'),
  ('demo-public-dance', 'large', 'demo/public/dance/1/large.webp', 'image/webp', 100556, 1536, 1024, 'd25dd99b47b8eaaa01b305e95be42c27ddcf21e8de6c078a86620578ce7d8452', '2026-09-20T00:00:00.000Z'),
  ('demo-public-ceremony', 'thumb', 'demo/public/ceremony/1/thumb.webp', 'image/webp', 33430, 480, 320, '18f0f9a2d4ce3d386bb92f4e1d4514d87e5b2b07a09d76d68eec83cf77ad2554', '2026-09-20T00:00:00.000Z'),
  ('demo-public-ceremony', 'medium', 'demo/public/ceremony/1/medium.webp', 'image/webp', 83358, 960, 640, '38c8b442f2ad3e81ced741d4a1f88245f553e725ca3c56b23b6f9e8c58118b96', '2026-09-20T00:00:00.000Z'),
  ('demo-public-ceremony', 'large', 'demo/public/ceremony/1/large.webp', 'image/webp', 146416, 1536, 1024, 'bb7c5f31e9933ed0496dbef86595c14cd719dbc565c8e39b10ad9c0b2370e728', '2026-09-20T00:00:00.000Z'),
  ('demo-private-family', 'thumb', 'demo/private/family/1/thumb.webp', 'image/webp', 50728, 480, 320, 'b6a21a9bcb65c2c61decf689318039df51c12082c90de953f2b75fe2cd647fe5', '2026-09-20T00:00:00.000Z'),
  ('demo-private-family', 'medium', 'demo/private/family/1/medium.webp', 'image/webp', 143556, 960, 640, 'ea213314e5208480ece37349812da000a6cc255e9d22cd70f4106bd49468a2d9', '2026-09-20T00:00:00.000Z'),
  ('demo-private-family', 'large', 'demo/private/family/1/large.webp', 'image/webp', 276332, 1536, 1024, 'a42df31dabe3608644293b415ec5a9abf13bf9232ed77e2893af26c2be1f8036', '2026-09-20T00:00:00.000Z'),
  ('demo-private-newborn', 'thumb', 'demo/private/newborn/1/thumb.webp', 'image/webp', 19612, 480, 320, 'a66a2d31810e92528699a881f69624087035c815a0bc69c434814f50dcd57b5c', '2026-09-20T00:00:00.000Z'),
  ('demo-private-newborn', 'medium', 'demo/private/newborn/1/medium.webp', 'image/webp', 51962, 960, 640, '5c74980b1f8ddd39a1a7051dc4eb6ea039321dd42872849c9feb0a60e98356ce', '2026-09-20T00:00:00.000Z'),
  ('demo-private-newborn', 'large', 'demo/private/newborn/1/large.webp', 'image/webp', 98284, 1536, 1024, '82c1294d76ae0a3aba1076bcae11c1a26a4ca7a372b03ab3127ff566c169630d', '2026-09-20T00:00:00.000Z')
ON CONFLICT(photo_id, variant) DO UPDATE SET
  storage_key = excluded.storage_key,
  content_type = excluded.content_type,
  byte_size = excluded.byte_size,
  width = excluded.width,
  height = excluded.height,
  checksum_sha256 = excluded.checksum_sha256,
  created_at = excluded.created_at;

DELETE FROM usage_counters WHERE key = '__demo_seed_assertion__';

INSERT INTO usage_counters (key, value, updated_at)
SELECT '__demo_seed_assertion__', -1, '2026-09-20T00:00:00.000Z'
WHERE NOT (
  (SELECT COUNT(*) FROM events WHERE id IN ('demo-public', 'demo-private')) = 2
  AND (SELECT COUNT(*) FROM photos WHERE id IN (
    'demo-public-ceremony', 'demo-public-dance', 'demo-private-family', 'demo-private-newborn'
  )) = 4
  AND (SELECT COUNT(*) FROM photo_variants WHERE photo_id IN (
    'demo-public-ceremony', 'demo-public-dance', 'demo-private-family', 'demo-private-newborn'
  )) = 12
);
