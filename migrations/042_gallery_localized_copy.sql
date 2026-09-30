-- Optional bilingual public copy; legacy owner galleries retain their existing title and description.
ALTER TABLE events ADD COLUMN localized_copy TEXT CHECK (localized_copy IS NULL OR json_valid(localized_copy));

-- Existing demonstration rows receive their translations without reseeding media or touching owner galleries.
UPDATE events SET localized_copy = json_object(
  'fr', json_object('title', 'Lumière et promesses',
    'description', 'Une célébration d’été racontée avec naturel, de la cérémonie jusqu’aux éclats de rire sur la piste de danse. Photos fictives créées pour la démonstration Cadrora.'),
  'en', json_object('title', 'Light and promises',
    'description', 'A summer celebration told naturally, from the ceremony to the laughter on the dance floor. Fictional photos created for the Cadrora demonstration.')
) WHERE id = 'demo-public' AND localized_copy IS NULL;

UPDATE events SET localized_copy = json_object(
  'fr', json_object('title', 'Instants en famille',
    'description', 'Galerie privée de démonstration. Mot de passe : cadrora-demo. Les personnes représentées sont fictives et ne sont pas de vrais clients.'),
  'en', json_object('title', 'Family moments',
    'description', 'Private demonstration gallery. Password: cadrora-demo. The people shown are fictional and are not real clients.')
) WHERE id = 'demo-private' AND localized_copy IS NULL;

UPDATE events SET localized_copy = json_object(
  'fr', json_object('title', 'Retrouvez vos photos',
    'description', 'Démonstration de recherche de photos : dix-neuf images fictives avec plusieurs invités. Essayez « Trouver mes photos » pour voir les correspondances possibles et les images prises au même moment.'),
  'en', json_object('title', 'Find your photos',
    'description', 'Photo search demonstration: nineteen fictional images with several guests. Try “Find my photos” to see possible matches and pictures taken around the same time.')
) WHERE id = 'demo-ai-face-search' AND localized_copy IS NULL;
