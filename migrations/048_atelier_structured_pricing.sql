-- Content-only conversion after ADR-054 support has been deployed.
-- Reuse the four existing Atelier sessions and their approved FR/EN wording.
-- Only convert unchanged legacy details from migration 047; preserve later edits.
-- Per-language guards also preserve any packages or practical information already entered.
-- No schema, route, photo, visibility, price-overview, or unrelated copy changes.

-- Birthday photography (fr)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.fr.tariffs', json('[
  {
    "name": "Mini — « Little Moments »",
    "price": "250 $ CAD",
    "summary": "Idéal pour une petite fête à la maison. Une heure de couverture discrète et spontanée, plus de 40 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures."
  },
  {
    "name": "Signature — « The Party »",
    "price": "450 $ CAD",
    "summary": "Notre forfait le plus populaire. Deux heures pour raconter toute la fête — l’arrivée des invités, les jeux, le gâteau et le joyeux désordre entre les deux — avec plus de 100 photos retouchées et un aperçu sous 24 heures."
  },
  {
    "name": "Complète — « The Whole Celebration »",
    "price": "650 $ CAD",
    "summary": "Pour les grandes fêtes et les étapes importantes. Jusqu’à trois heures de couverture et plus de 200 photos retouchées dans votre galerie privée en ligne."
  }
]'),
      '$.fr.goodToKnow', 'Heure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.',
      '$.fr.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea'
  AND json_extract(copy_json, '$.fr.details') = json_extract('{"details":"Mini — « Little Moments » — 250 $ CAD\nIdéal pour une petite fête à la maison. Une heure de couverture discrète et spontanée, plus de 40 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Party » — 450 $ CAD\nNotre forfait le plus populaire. Deux heures pour raconter toute la fête — l’arrivée des invités, les jeux, le gâteau et le joyeux désordre entre les deux — avec plus de 100 photos retouchées et un aperçu sous 24 heures.\n\nComplète — « The Whole Celebration » — 650 $ CAD\nPour les grandes fêtes et les étapes importantes. Jusqu’à trois heures de couverture et plus de 200 photos retouchées dans votre galerie privée en ligne.\n\nBon à savoir\nHeure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.fr.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.fr.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Birthday photography (en)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.en.tariffs', json('[
  {
    "name": "Mini — “Little Moments”",
    "price": "250 $ CAD",
    "summary": "Perfect for a small at-home party. One hour of quiet, candid coverage, 40+ edited photos in your private online gallery, with sneak peeks within 48 hours."
  },
  {
    "name": "Signature — “The Party”",
    "price": "450 $ CAD",
    "summary": "Our most popular. Two hours covering the full party arc — guests arriving, games, cake, and the happy chaos in between — with 100+ edited photos and sneak peeks within 24 hours."
  },
  {
    "name": "Complète — “The Whole Celebration”",
    "price": "650 $ CAD",
    "summary": "For big parties and milestones. Up to three hours of coverage and 200+ edited photos in your private online gallery."
  }
]'),
      '$.en.goodToKnow', 'Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date.',
      '$.en.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea'
  AND json_extract(copy_json, '$.en.details') = json_extract('{"details":"Mini — “Little Moments” — 250 $ CAD\nPerfect for a small at-home party. One hour of quiet, candid coverage, 40+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Party” — 450 $ CAD\nOur most popular. Two hours covering the full party arc — guests arriving, games, cake, and the happy chaos in between — with 100+ edited photos and sneak peeks within 24 hours.\n\nComplète — “The Whole Celebration” — 650 $ CAD\nFor big parties and milestones. Up to three hours of coverage and 200+ edited photos in your private online gallery.\n\nGood to know\nExtra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.en.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.en.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Maternity (fr)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.fr.tariffs', json('[
  {
    "name": "Mini — « First Bloom »",
    "price": "350 $ CAD",
    "summary": "Idéal pour une séance simple et douce. 45 minutes de prise de vue en douceur, plus de 30 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures."
  },
  {
    "name": "Signature — « The Glow »",
    "price": "500 $ CAD",
    "summary": "Notre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, votre partenaire inclus, un changement de tenue et un aperçu sous 24 heures."
  },
  {
    "name": "Complète — « The Whole Story »",
    "price": "750 $ CAD",
    "summary": "Pour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, votre partenaire et votre famille inclus, plusieurs tenues et votre galerie privée en ligne."
  }
]'),
      '$.fr.goodToKnow', 'À prévoir idéalement entre la 28e et la 34e semaine de grossesse. Heure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.',
      '$.fr.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity'
  AND json_extract(copy_json, '$.fr.details') = json_extract('{"details":"Mini — « First Bloom » — 350 $ CAD\nIdéal pour une séance simple et douce. 45 minutes de prise de vue en douceur, plus de 30 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Glow » — 500 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, votre partenaire inclus, un changement de tenue et un aperçu sous 24 heures.\n\nComplète — « The Whole Story » — 750 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, votre partenaire et votre famille inclus, plusieurs tenues et votre galerie privée en ligne.\n\nBon à savoir\nÀ prévoir idéalement entre la 28e et la 34e semaine de grossesse. Heure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.fr.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.fr.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Maternity (en)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.en.tariffs', json('[
  {
    "name": "Mini — “First Bloom”",
    "price": "350 $ CAD",
    "summary": "Perfect for a simple, sweet session. 45 minutes of gentle coverage, 30+ edited photos in your private online gallery, with sneak peeks within 48 hours."
  },
  {
    "name": "Signature — “The Glow”",
    "price": "500 $ CAD",
    "summary": "Our most popular. 1.5 hours, 60+ edited photos, partner included, one outfit change, and sneak peeks within 24 hours."
  },
  {
    "name": "Complète — “The Whole Story”",
    "price": "750 $ CAD",
    "summary": "For the full experience. Up to 2 hours, 100+ edited photos, partner and family included, multiple outfits, and your private online gallery."
  }
]'),
      '$.en.goodToKnow', 'Best scheduled between 28 and 34 weeks of pregnancy. Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date.',
      '$.en.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity'
  AND json_extract(copy_json, '$.en.details') = json_extract('{"details":"Mini — “First Bloom” — 350 $ CAD\nPerfect for a simple, sweet session. 45 minutes of gentle coverage, 30+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Glow” — 500 $ CAD\nOur most popular. 1.5 hours, 60+ edited photos, partner included, one outfit change, and sneak peeks within 24 hours.\n\nComplète — “The Whole Story” — 750 $ CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, partner and family included, multiple outfits, and your private online gallery.\n\nGood to know\nBest scheduled between 28 and 34 weeks of pregnancy. Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.en.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.en.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Portraits Photography (fr)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.fr.tariffs', json('[
  {
    "name": "Mini — « First Look »",
    "price": "250 $ CAD",
    "summary": "Idéal pour une première expérience de portrait. 45 minutes de prise de vue en douceur, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures."
  },
  {
    "name": "Signature — « The Rediscovery »",
    "price": "450 $ CAD",
    "summary": "Notre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un changement de tenue, des conseils de pose tout en douceur et un aperçu sous 24 heures."
  },
  {
    "name": "Complète — « The Full Story »",
    "price": "650 $ CAD",
    "summary": "Pour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs tenues, deux lieux si vous le souhaitez et votre galerie privée en ligne."
  }
]'),
      '$.fr.goodToKnow', 'Heure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.',
      '$.fr.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait'
  AND json_extract(copy_json, '$.fr.details') = json_extract('{"details":"Mini — « First Look » — 250 $ CAD\nIdéal pour une première expérience de portrait. 45 minutes de prise de vue en douceur, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Rediscovery » — 450 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un changement de tenue, des conseils de pose tout en douceur et un aperçu sous 24 heures.\n\nComplète — « The Full Story » — 650 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs tenues, deux lieux si vous le souhaitez et votre galerie privée en ligne.\n\nBon à savoir\nHeure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.fr.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.fr.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Portraits Photography (en)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.en.tariffs', json('[
  {
    "name": "Mini — “First Look”",
    "price": "$250 CAD",
    "summary": "Perfect for a first portrait experience. 45 minutes of gentle coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours."
  },
  {
    "name": "Signature — “The Rediscovery”",
    "price": "$450 CAD",
    "summary": "Our most popular. 1.5 hours, 60+ edited photos, one outfit change, gentle posing guidance the whole way, and sneak peeks within 24 hours."
  },
  {
    "name": "Complète — “The Full Story”",
    "price": "$650 CAD",
    "summary": "For the full experience. Up to 2 hours, 100+ edited photos, multiple outfits, two locations if you like, and your private online gallery."
  }
]'),
      '$.en.goodToKnow', 'Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.',
      '$.en.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait'
  AND json_extract(copy_json, '$.en.details') = json_extract('{"details":"Mini — “First Look” — $250 CAD\nPerfect for a first portrait experience. 45 minutes of gentle coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Rediscovery” — $450 CAD\nOur most popular. 1.5 hours, 60+ edited photos, one outfit change, gentle posing guidance the whole way, and sneak peeks within 24 hours.\n\nComplète — “The Full Story” — $650 CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, multiple outfits, two locations if you like, and your private online gallery.\n\nGood to know\nExtra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.en.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.en.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Couples Photography (fr)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.fr.tariffs', json('[
  {
    "name": "Mini — « First Date »",
    "price": "300 $ CAD",
    "summary": "Idéal pour une séance simple à deux. 45 minutes de prise de vue détendue, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures."
  },
  {
    "name": "Signature — « Love & Laughter »",
    "price": "450 $ CAD",
    "summary": "Notre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un lieu de votre choix, des conseils en douceur tout au long de la séance et un aperçu sous 24 heures."
  },
  {
    "name": "Complète — « Your Story »",
    "price": "650 $ CAD",
    "summary": "Pour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs lieux ou tenues et votre galerie privée en ligne."
  }
]'),
      '$.fr.goodToKnow', 'Parfait pour un anniversaire de couple, des fiançailles ou simplement pour le plaisir — aucune occasion nécessaire. Heure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.',
      '$.fr.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples'
  AND json_extract(copy_json, '$.fr.details') = json_extract('{"details":"Mini — « First Date » — 300 $ CAD\nIdéal pour une séance simple à deux. 45 minutes de prise de vue détendue, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « Love & Laughter » — 450 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un lieu de votre choix, des conseils en douceur tout au long de la séance et un aperçu sous 24 heures.\n\nComplète — « Your Story » — 650 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs lieux ou tenues et votre galerie privée en ligne.\n\nBon à savoir\nParfait pour un anniversaire de couple, des fiançailles ou simplement pour le plaisir — aucune occasion nécessaire. Heure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.fr.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.fr.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

-- Couples Photography (en)
UPDATE site_services
SET copy_json = json_set(copy_json,
      '$.en.tariffs', json('[
  {
    "name": "Mini — “First Date”",
    "price": "$300 CAD",
    "summary": "Perfect for a simple session together. 45 minutes of relaxed coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours."
  },
  {
    "name": "Signature — “Love & Laughter”",
    "price": "$450 CAD",
    "summary": "Our most popular. 1.5 hours, 60+ edited photos, one location of your choice, gentle guidance the whole way, and sneak peeks within 24 hours."
  },
  {
    "name": "Complète — “Your Story”",
    "price": "$650 CAD",
    "summary": "For the full experience. Up to 2 hours, 100+ edited photos, multiple locations or outfits, and your private online gallery."
  }
]'),
      '$.en.goodToKnow', 'Perfect for anniversaries, engagements, or just because — no occasion needed. Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.',
      '$.en.details', ''),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples'
  AND json_extract(copy_json, '$.en.details') = json_extract('{"details":"Mini — “First Date” — $300 CAD\nPerfect for a simple session together. 45 minutes of relaxed coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “Love & Laughter” — $450 CAD\nOur most popular. 1.5 hours, 60+ edited photos, one location of your choice, gentle guidance the whole way, and sneak peeks within 24 hours.\n\nComplète — “Your Story” — $650 CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, multiple locations or outfits, and your private online gallery.\n\nGood to know\nPerfect for anniversaries, engagements, or just because — no occasion needed. Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date."}', '$.details')
  AND COALESCE(json_array_length(copy_json, '$.en.tariffs'), 0) = 0
  AND COALESCE(json_extract(copy_json, '$.en.goodToKnow'), '') = ''
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');
