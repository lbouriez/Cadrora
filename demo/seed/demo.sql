PRAGMA foreign_keys = ON;

INSERT INTO events (
  id, slug, title, description, starts_at, timezone, cover_photo_id,
  visibility, access, allow_downloads, face_search_enabled, nearby_search_enabled, show_photo_metadata, keep_originals,
  retention_days, revision, created_at, updated_at
) VALUES
  (
    'demo-public', 'lumiere-et-promesses', 'Lumière et promesses',
    'Une célébration d''été racontée avec naturel, de la cérémonie jusqu''aux éclats de rire sur la piste de danse. Contenu entièrement généré pour la démonstration Cadrora.',
    '2026-06-14T20:00:00.000Z', 'America/Toronto', 'demo-public-ceremony',
    'published', 'public', 0, 0, 0, 1, 0, NULL, 1,
    '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'
  ),
  (
    'demo-private', 'instants-en-famille', 'Instants en famille',
    'Galerie privée de démonstration — mot de passe : cadrora-demo. Les personnes présentées sont générées et ne sont pas de vrais clients.',
    '2026-10-04T15:00:00.000Z', 'America/Toronto', 'demo-private-family',
    'published', 'protected', 0, 0, 0, 1, 0, NULL, 1,
    '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'
  ),
  (
    'demo-ai-face-search', 'find-your-photos', 'Retrouvez vos photos',
    'Démonstration IA : quinze images fictives, créées pour présenter la recherche de photos par selfie. Un troisième invité distinct apparaît dans cinq scènes afin de vérifier que la recherche ne confond pas les visages — essayez le parcours « Trouver mes photos ».',
    '2026-08-30T18:00:00.000Z', 'America/Toronto', 'demo-ai-01',
    'published', 'public', 1, 1, 1, 1, 0, NULL, 1,
    '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'
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
  nearby_search_enabled = excluded.nearby_search_enabled,
  show_photo_metadata = excluded.show_photo_metadata,
  keep_originals = excluded.keep_originals,
  retention_days = excluded.retention_days,
  offline_at = NULL,
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
  ('demo-private-import', 'demo-private', 'completed', 2, 2, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-ai-face-search-import', 'demo-ai-face-search', 'completed', 15, 15, '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z')
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
  ('demo-private-newborn', 'demo-private', 'demo-private-import', 'nouveau-ne.webp', 'image/webp', 1536, 1024, '2026-10-04T16:00:00.000Z', NULL, '002', 1, 'published', 'disabled', '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
  ('demo-ai-01', 'demo-ai-face-search', 'demo-ai-face-search-import', 'arrivee.webp', 'image/webp', 1536, 1024, '2026-08-30T18:00:00.000Z', 'arrival', '001', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-02', 'demo-ai-face-search', 'demo-ai-face-search-import', 'ceremonie.webp', 'image/webp', 1536, 1024, '2026-08-30T18:15:00.000Z', 'ceremony', '002', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-03', 'demo-ai-face-search', 'demo-ai-face-search-import', 'eclats-de-rire.webp', 'image/webp', 1536, 1024, '2026-08-30T18:30:00.000Z', 'cocktails', '003', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-04', 'demo-ai-face-search', 'demo-ai-face-search-import', 'la-cour.webp', 'image/webp', 1536, 1024, '2026-08-30T18:45:00.000Z', 'cocktails', '004', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-05', 'demo-ai-face-search', 'demo-ai-face-search-import', 'jardin.webp', 'image/webp', 1536, 1024, '2026-08-30T19:00:00.000Z', 'garden', '005', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-06', 'demo-ai-face-search', 'demo-ai-face-search-import', 'premiere-danse.webp', 'image/webp', 1536, 1024, '2026-08-30T20:30:00.000Z', 'dance', '006', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-07', 'demo-ai-face-search', 'demo-ai-face-search-import', 'famille.webp', 'image/webp', 1536, 1024, '2026-08-30T20:45:00.000Z', 'reception', '007', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-08', 'demo-ai-face-search', 'demo-ai-face-search-import', 'diner.webp', 'image/webp', 1536, 1024, '2026-08-30T21:00:00.000Z', 'reception', '008', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-09', 'demo-ai-face-search', 'demo-ai-face-search-import', 'coucher-de-soleil.webp', 'image/webp', 1536, 1024, '2026-08-30T21:15:00.000Z', 'sunset', '009', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-10', 'demo-ai-face-search', 'demo-ai-face-search-import', 'piste-de-danse.webp', 'image/webp', 1536, 1024, '2026-08-30T21:30:00.000Z', 'dance', '010', 1, 'published', 'ready', '2026-09-21T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-11', 'demo-ai-face-search', 'demo-ai-face-search-import', 'arrivee-malik.webp', 'image/webp', 1536, 1024, '2026-08-30T18:02:00.000Z', 'arrival', '011', 1, 'published', 'ready', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-12', 'demo-ai-face-search', 'demo-ai-face-search-import', 'applaudissements-malik.webp', 'image/webp', 1536, 1024, '2026-08-30T18:16:00.000Z', 'ceremony', '012', 1, 'published', 'ready', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-13', 'demo-ai-face-search', 'demo-ai-face-search-import', 'cocktail-malik.webp', 'image/webp', 1536, 1024, '2026-08-30T18:32:00.000Z', 'cocktails', '013', 1, 'published', 'ready', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-14', 'demo-ai-face-search', 'demo-ai-face-search-import', 'diner-malik.webp', 'image/webp', 1536, 1024, '2026-08-30T21:02:00.000Z', 'reception', '014', 1, 'published', 'ready', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-15', 'demo-ai-face-search', 'demo-ai-face-search-import', 'danse-malik.webp', 'image/webp', 1536, 1024, '2026-08-30T21:32:00.000Z', 'dance', '015', 1, 'published', 'ready', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z')
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
  ('demo-private-newborn', 'large', 'demo/private/newborn/1/large.webp', 'image/webp', 98284, 1536, 1024, '82c1294d76ae0a3aba1076bcae11c1a26a4ca7a372b03ab3127ff566c169630d', '2026-09-20T00:00:00.000Z'),
  ('demo-ai-01', 'thumb', 'demo/ai-face-search/01/1/thumb.webp', 'image/webp', 23128, 480, 320, '0ab603f6a70e08cc1fa2a75769651b9cffb8d0a00b5963f49a398357fd59fa97', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-01', 'medium', 'demo/ai-face-search/01/1/medium.webp', 'image/webp', 56418, 960, 640, '06df9024f899721315fb93f372dac9d441eea809070dc66d86cc43342fea88f9', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-01', 'large', 'demo/ai-face-search/01/1/large.webp', 'image/webp', 112916, 1536, 1024, '736e99456e9f7fd68ee0ae6af8839130d51b1ef263bfb520c00c62bc0b250d80', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-01', 'download', 'demo/ai-face-search/01/1/download.webp', 'image/webp', 112916, 1536, 1024, '736e99456e9f7fd68ee0ae6af8839130d51b1ef263bfb520c00c62bc0b250d80', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-02', 'thumb', 'demo/ai-face-search/02/1/thumb.webp', 'image/webp', 18048, 480, 320, '9a4d07822af421d0a58046e4f20809538ef1e0e22dc3a43b393e51c79c2c1332', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-02', 'medium', 'demo/ai-face-search/02/1/medium.webp', 'image/webp', 44672, 960, 640, '3766a323fdb93a6576b29d0ba3bf58b1738f42e9b8d47e665797c4b6538181da', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-02', 'large', 'demo/ai-face-search/02/1/large.webp', 'image/webp', 92474, 1536, 1024, '46275fe91300beb7fd605572dc88101c7d6b80d8b78ed8eafe8ae9fa92fac762', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-02', 'download', 'demo/ai-face-search/02/1/download.webp', 'image/webp', 92474, 1536, 1024, '46275fe91300beb7fd605572dc88101c7d6b80d8b78ed8eafe8ae9fa92fac762', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-03', 'thumb', 'demo/ai-face-search/03/1/thumb.webp', 'image/webp', 18540, 480, 320, '31bf96a5612417070f6944287bbd6854621cde48b621d5da34131ae6aeab6a02', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-03', 'medium', 'demo/ai-face-search/03/1/medium.webp', 'image/webp', 46298, 960, 640, '256498fada819337581244ee71ec89c9e76f580fb23eea5fbbe293a49f524f42', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-03', 'large', 'demo/ai-face-search/03/1/large.webp', 'image/webp', 96904, 1536, 1024, 'accc6757dc639839cf9d5012e3c0444d0e387bf6487238e9c5ae10f414adcfbe', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-03', 'download', 'demo/ai-face-search/03/1/download.webp', 'image/webp', 96904, 1536, 1024, 'accc6757dc639839cf9d5012e3c0444d0e387bf6487238e9c5ae10f414adcfbe', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-04', 'thumb', 'demo/ai-face-search/04/1/thumb.webp', 'image/webp', 35254, 480, 320, '52abc25cb36a7594004d0c8200a8670fe29b809b12f89cd842fe55981778b759', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-04', 'medium', 'demo/ai-face-search/04/1/medium.webp', 'image/webp', 88974, 960, 640, '17c183c402971f381c2b5585a7562fe112355a404652aa5be755a47c85c2a67d', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-04', 'large', 'demo/ai-face-search/04/1/large.webp', 'image/webp', 173802, 1536, 1024, 'a82844118ced860a98baa733123875c5bc0384b5cf1e1b79964bcc9535af4b9e', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-04', 'download', 'demo/ai-face-search/04/1/download.webp', 'image/webp', 173802, 1536, 1024, 'a82844118ced860a98baa733123875c5bc0384b5cf1e1b79964bcc9535af4b9e', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-05', 'thumb', 'demo/ai-face-search/05/1/thumb.webp', 'image/webp', 29880, 480, 320, '596efcf07fde1cfc154010013f32bcb306e9d3c048ace48b0573e55372f85d5b', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-05', 'medium', 'demo/ai-face-search/05/1/medium.webp', 'image/webp', 72076, 960, 640, 'a5df5f62287b8bafa963c223502c47a9b9642b774d109fe719c5458f5b651861', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-05', 'large', 'demo/ai-face-search/05/1/large.webp', 'image/webp', 147420, 1536, 1024, '8709ef4d40cb2896e5054bfd2676884499ded59a5e1b41ded09991695150ee09', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-05', 'download', 'demo/ai-face-search/05/1/download.webp', 'image/webp', 147420, 1536, 1024, '8709ef4d40cb2896e5054bfd2676884499ded59a5e1b41ded09991695150ee09', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-06', 'thumb', 'demo/ai-face-search/06/1/thumb.webp', 'image/webp', 16542, 480, 320, 'b48d1cf65f894ead1c890f35a98a3117f6203ad7d9599aabb6a725153f20c08e', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-06', 'medium', 'demo/ai-face-search/06/1/medium.webp', 'image/webp', 39732, 960, 640, '4c97414be1a2ee469380a8a3677d2c7ef217bc31f7938cd955de3439fa7de0b3', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-06', 'large', 'demo/ai-face-search/06/1/large.webp', 'image/webp', 84026, 1536, 1024, 'bdc1cd991df32131ab5acb47c81dc4b4331bc4dee048316d12869a02561ac0e2', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-07', 'thumb', 'demo/ai-face-search/07/1/thumb.webp', 'image/webp', 22938, 480, 320, '25bd8794a185ad1859cedfaf6474b157bc49cadde9e439fe8fbb3cb0f92c173c', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-07', 'medium', 'demo/ai-face-search/07/1/medium.webp', 'image/webp', 57298, 960, 640, '59f47a8cfa734033f8a71735fc1b4b39356bd2e6c327e59a0a48ee554fd6bb8d', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-07', 'large', 'demo/ai-face-search/07/1/large.webp', 'image/webp', 117872, 1536, 1024, '16d01ceeba697027cc7b2167cd17f102994719644df1c200711713747afdc801', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-08', 'thumb', 'demo/ai-face-search/08/1/thumb.webp', 'image/webp', 20810, 480, 320, '35deedc3e5db86fa2cad4a3249c81910187509f115a59326fb6f724a8d5b8c0b', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-08', 'medium', 'demo/ai-face-search/08/1/medium.webp', 'image/webp', 49548, 960, 640, 'fcc9528463ad9b5e414ab6372516b12d9de4ba456bd4d37058f20a9b8931c113', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-08', 'large', 'demo/ai-face-search/08/1/large.webp', 'image/webp', 101588, 1536, 1024, '63bb7773c9e457ab142e8b194f199ad8ce6a19239711a913acdefa8a70152951', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-09', 'thumb', 'demo/ai-face-search/09/1/thumb.webp', 'image/webp', 13360, 480, 320, 'e8f386ffff99cc9348fdf480ca1be7c017a9708b988c12dac0cff4eca1a6e280', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-09', 'medium', 'demo/ai-face-search/09/1/medium.webp', 'image/webp', 33698, 960, 640, 'e88fb238f637725cfcc51c12be54cd256f3df525139ff86e0a63c5fe4a10ab4f', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-09', 'large', 'demo/ai-face-search/09/1/large.webp', 'image/webp', 74248, 1536, 1024, 'd474cab80defd7ec7841255f63f58635222c827ece973682a41f6cfb6ac8bfaf', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-10', 'thumb', 'demo/ai-face-search/10/1/thumb.webp', 'image/webp', 19220, 480, 320, 'a4bfc80de9a8ec75716b3ef8c026919d38ede0d6cabaa307b2c5dea14b7cbbb9', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-10', 'medium', 'demo/ai-face-search/10/1/medium.webp', 'image/webp', 46658, 960, 640, 'ab631cfc5660277044b9ea4d3a076f816311523bc0a24c065f87d4b07e53257a', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-10', 'large', 'demo/ai-face-search/10/1/large.webp', 'image/webp', 98130, 1536, 1024, 'b229a4b7d6e2ba04e30f63cfffd594b8ab6c07d26308dd42714e89c56be5f343', '2026-09-21T00:00:00.000Z'),
  ('demo-ai-11', 'thumb', 'demo/ai-face-search/11/1/thumb.webp', 'image/webp', 20736, 480, 320, 'a633ab94c0838289e82b0c46bd792a975c295e0e0b5f0f4c66822787023dd14e', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-11', 'medium', 'demo/ai-face-search/11/1/medium.webp', 'image/webp', 47570, 960, 640, '1576f5536cb5ef9bec95198558b9c63dea639433a323593c1d230086a6c873a4', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-11', 'large', 'demo/ai-face-search/11/1/large.webp', 'image/webp', 87192, 1536, 1024, '7b22789430b7ce417a7409936c50587e3ac3303cfbd1e1c93fb8e3fb1f7c18a7', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-12', 'thumb', 'demo/ai-face-search/12/1/thumb.webp', 'image/webp', 21600, 480, 320, '01eadd65bc7a33db42b9d90cb202fabeb4a5df6b112ffa399ded5936af8a6c2c', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-12', 'medium', 'demo/ai-face-search/12/1/medium.webp', 'image/webp', 50424, 960, 640, 'e63b1a0e10803821a57f82648411dca8d05cb79b1577e728536fc9792cde7ccd', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-12', 'large', 'demo/ai-face-search/12/1/large.webp', 'image/webp', 92108, 1536, 1024, '02385ce5476808c73701949392451631e3300d241ba440eec179977314b10e43', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-13', 'thumb', 'demo/ai-face-search/13/1/thumb.webp', 'image/webp', 23074, 480, 320, 'e16ff364b6344a3c73451d582ee9fb386c8f88a2a3176965cbde9c411da974de', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-13', 'medium', 'demo/ai-face-search/13/1/medium.webp', 'image/webp', 53102, 960, 640, '7fa7a8919d120f2493578d84fdaebf0759c07ef3d35d99f08e10061367e95926', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-13', 'large', 'demo/ai-face-search/13/1/large.webp', 'image/webp', 96124, 1536, 1024, 'ab80dac706e53f23da68384a1e034c3572dcda7ad6181d77c19f5210cd0b4231', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-14', 'thumb', 'demo/ai-face-search/14/1/thumb.webp', 'image/webp', 26430, 480, 320, 'fd625ed5cffecd5b80b267930570aad8a210a228d20d185fc76684cf1d068ac6', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-14', 'medium', 'demo/ai-face-search/14/1/medium.webp', 'image/webp', 61424, 960, 640, 'ef8b63797a8bf34ef814bd0c1c7b146201ddf2fc889a615cdc8e24c17163a566', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-14', 'large', 'demo/ai-face-search/14/1/large.webp', 'image/webp', 111120, 1536, 1024, 'a025709682387bd240b5caaf30a60f5bd2495f8df9f222b7d257acbbbf9219ea', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-15', 'thumb', 'demo/ai-face-search/15/1/thumb.webp', 'image/webp', 26936, 480, 320, '31002c4895f65e1758bddf909498f64970c77186d5410b4c400685a03be8c12a', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-15', 'medium', 'demo/ai-face-search/15/1/medium.webp', 'image/webp', 62376, 960, 640, 'bd6dc1c97359dd558ccf0d0fdd34886ac0e8b7965e75cfc27320db014aa5dc64', '2026-09-22T00:00:00.000Z'),
  ('demo-ai-15', 'large', 'demo/ai-face-search/15/1/large.webp', 'image/webp', 112468, 1536, 1024, '3520b4a31e452cca57e49e587e21f2a1904033b6507efe58fb6b655397e8e236', '2026-09-22T00:00:00.000Z')
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
  (SELECT COUNT(*) FROM events WHERE id IN ('demo-public', 'demo-private', 'demo-ai-face-search')) = 3
  AND (SELECT COUNT(*) FROM photos WHERE id IN (
    'demo-public-ceremony', 'demo-public-dance', 'demo-private-family', 'demo-private-newborn',
    'demo-ai-01', 'demo-ai-02', 'demo-ai-03', 'demo-ai-04', 'demo-ai-05',
    'demo-ai-06', 'demo-ai-07', 'demo-ai-08', 'demo-ai-09', 'demo-ai-10',
    'demo-ai-11', 'demo-ai-12', 'demo-ai-13', 'demo-ai-14', 'demo-ai-15'
  )) = 19
  AND (SELECT COUNT(*) FROM photo_variants WHERE photo_id IN (
    'demo-public-ceremony', 'demo-public-dance', 'demo-private-family', 'demo-private-newborn',
    'demo-ai-01', 'demo-ai-02', 'demo-ai-03', 'demo-ai-04', 'demo-ai-05',
    'demo-ai-06', 'demo-ai-07', 'demo-ai-08', 'demo-ai-09', 'demo-ai-10',
    'demo-ai-11', 'demo-ai-12', 'demo-ai-13', 'demo-ai-14', 'demo-ai-15'
  )) = 62
);
