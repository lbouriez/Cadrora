-- Owner-requested content only, for the existing Atelier Giulia catalogue.
-- Requires the shared 1,000-character description / eight-inclusion limits.
-- Packages and practical information use the existing details field.
-- No schema, routes, media, ordering, or visibility changes; no new sessions.
-- Birthday uses the existing custom session ID verified in the public catalogue.

-- birthday
WITH requested(copy) AS (VALUES ('{
  "fr": {
    "title": "Photo d’anniversaire",
    "shortDescription": "Un regard discret pour capturer de beaux souvenirs d’anniversaire.",
    "description": "Les anniversaires, magnifiquement capturés — pendant que vous en profitez vraiment. Toutes les mamans connaissent ce sentiment : vous passez des semaines à organiser la fête parfaite, et à la fin de la journée, il vous reste trois photos floues — toutes prises par vous, de tous les autres. C’est là que j’interviens. Je photographie l’anniversaire de votre enfant discrètement, en arrière-plan, pour que vous puissiez être pleinement présente. Le sourire plein de gâteau, les fous rires entre amis, les larmes de joie de grand-maman, le moment des bougies que vous voudrez garder pour toujours. Pas de poses figées, pas d’interruption de la fête — simplement des moments vrais et joyeux, livrés dans une belle galerie en ligne à partager en famille. Moi-même maman de deux jeunes enfants, je sais exactement quels moments vous risqueriez de manquer. Je m’assure de les capturer pour vous.",
    "points": [
      "1, 2 ou 3 heures de couverture discrète et spontanée",
      "De 40 à plus de 200 photos retouchées, selon le forfait",
      "Une galerie privée en ligne à partager en famille",
      "Un aperçu sous 24 à 48 heures",
      "Tous les moments vrais : gâteau, jeux, amis et réactions de la famille",
      "Pas de poses figées, pas d’interruption de la fête"
    ],
    "duration": "1, 2 ou 3 heures",
    "priceRange": "Mini — 250 $ · Signature — 450 $ · Complète — 650 $ (CAD)",
    "details": "Mini — « Little Moments » — 250 $ CAD\nIdéal pour une petite fête à la maison. Une heure de couverture discrète et spontanée, plus de 40 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Party » — 450 $ CAD\nNotre forfait le plus populaire. Deux heures pour raconter toute la fête — l’arrivée des invités, les jeux, le gâteau et le joyeux désordre entre les deux — avec plus de 100 photos retouchées et un aperçu sous 24 heures.\n\nComplète — « The Whole Celebration » — 650 $ CAD\nPour les grandes fêtes et les étapes importantes. Jusqu’à trois heures de couverture et plus de 200 photos retouchées dans votre galerie privée en ligne.\n\nBon à savoir\nHeure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."
  },
  "en": {
    "title": "Birthday photography",
    "shortDescription": "A discreet eye capturing beautiful birthday memories.",
    "description": "Birthdays, beautifully captured — while you actually enjoy them. Every mom knows this feeling: you spend weeks planning the perfect party, and at the end of the day you have three blurry photos — all taken by you, of everyone else. That''s where I come in. I photograph your child''s birthday quietly, from the background, so you can be fully present. The cake-face grin, the giggles with best friends, grandma''s happy tears, the candle moment you''ll want to remember forever. No stiff posing, no interrupting the fun — just real, joyful moments, delivered in a beautiful online gallery to share with family. As a mom of two little ones myself, I know exactly which moments you''d miss. I make sure you don''t.",
    "points": [
      "1, 2 or 3 hours of discreet, candid coverage",
      "40 to 200+ edited photos, depending on your package",
      "Private online gallery to share with family",
      "Sneak peeks within 24–48 hours",
      "All the real moments: cake, games, friends, family reactions",
      "No stiff posing, no interruption of the fun"
    ],
    "duration": "1, 2 or 3 hours",
    "priceRange": "Mini — 250 $ · Signature — 450 $ · Complète — 650 $ (CAD)",
    "details": "Mini — “Little Moments” — 250 $ CAD\nPerfect for a small at-home party. One hour of quiet, candid coverage, 40+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Party” — 450 $ CAD\nOur most popular. Two hours covering the full party arc — guests arriving, games, cake, and the happy chaos in between — with 100+ edited photos and sneak peeks within 24 hours.\n\nComplète — “The Whole Celebration” — 650 $ CAD\nFor big parties and milestones. Up to three hours of coverage and 200+ edited photos in your private online gallery.\n\nGood to know\nExtra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date."
  }
}'))
UPDATE site_services
SET copy_json = json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com')
  AND COALESCE(copy_json, '{}') <> json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested));

-- maternity
WITH requested(copy) AS (VALUES ('{
  "fr": {
    "title": "Maternité",
    "shortDescription": "La beauté de devenir mère.",
    "description": "La maternité, magnifiquement capturée — avant que la vie ne change pour toujours. Il y a cette courte et précieuse période où vous rayonnez, le ventre arrondi, dans l’attente — et elle passe plus vite qu’on ne le pense. Je photographie ce moment en douceur, à votre rythme, dans une lumière tendre : des portraits naturels qui révèlent votre beauté et l’amour qui entoure déjà votre bébé. Pas de poses figées, pas de pression — simplement vous, sereine et rayonnante, telle que vous êtes.",
    "points": [
      "Une séance sereine, à votre rythme",
      "Des portraits naturels avant l’arrivée de bébé",
      "Une galerie privée à revoir et à partager",
      "De 30 à plus de 100 photos retouchées, selon le forfait",
      "Un aperçu sous 24 à 48 heures"
    ],
    "duration": "45 minutes à 2 heures",
    "priceRange": "Mini — 350 $ · Signature — 500 $ · Complète — 750 $ (CAD)",
    "details": "Mini — « First Bloom » — 350 $ CAD\nIdéal pour une séance simple et douce. 45 minutes de prise de vue en douceur, plus de 30 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Glow » — 500 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, votre partenaire inclus, un changement de tenue et un aperçu sous 24 heures.\n\nComplète — « The Whole Story » — 750 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, votre partenaire et votre famille inclus, plusieurs tenues et votre galerie privée en ligne.\n\nBon à savoir\nÀ prévoir idéalement entre la 28e et la 34e semaine de grossesse. Heure supplémentaire : 100 $ CAD. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date."
  },
  "en": {
    "title": "Maternity",
    "shortDescription": "The beauty of becoming a mother.",
    "description": "Maternity, beautifully captured — before life changes forever. There is a short, precious window when you are glowing, round, and waiting — and it passes faster than you think. I photograph this moment gently, at your pace, in soft light: natural portraits that show your beauty and the love already surrounding your baby. No stiff posing, no pressure — just you, calm and radiant, exactly as you are.",
    "points": [
      "A calm session shaped around your comfort",
      "Natural portraits before your baby arrives",
      "A private gallery to revisit and share",
      "30 to 100+ edited photos, depending on your package",
      "Sneak peeks within 24–48 hours"
    ],
    "duration": "45 minutes to 2 hours",
    "priceRange": "Mini — 350 $ · Signature — 500 $ · Complète — 750 $ (CAD)",
    "details": "Mini — “First Bloom” — 350 $ CAD\nPerfect for a simple, sweet session. 45 minutes of gentle coverage, 30+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Glow” — 500 $ CAD\nOur most popular. 1.5 hours, 60+ edited photos, partner included, one outfit change, and sneak peeks within 24 hours.\n\nComplète — “The Whole Story” — 750 $ CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, partner and family included, multiple outfits, and your private online gallery.\n\nGood to know\nBest scheduled between 28 and 34 weeks of pregnancy. Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date."
  }
}'))
UPDATE site_services
SET copy_json = json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com')
  AND COALESCE(copy_json, '{}') <> json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested));

-- portrait
WITH requested(copy) AS (VALUES ('{
  "en": {
    "title": "Portraits Photography",
    "shortDescription": "Every face tells a story.",
    "description": "Portraits, beautifully captured — a gift to yourself. This session is for anyone who wants to celebrate themselves, exactly as they are. For a new chapter, a birthday, a moment worth remembering — or simply for the fun of being in front of the camera for once. No experience needed: I guide you gently, in soft, flattering light, and we keep it relaxed until the photos look like you on your very best day. Every face tells a story — and every shade of beauty belongs here.",
    "duration": "45 minutes to 2 hours",
    "priceRange": "Mini — $250 · Signature — $450 · Complète — $650 (CAD)",
    "details": "Mini — “First Look” — $250 CAD\nPerfect for a first portrait experience. 45 minutes of gentle coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “The Rediscovery” — $450 CAD\nOur most popular. 1.5 hours, 60+ edited photos, one outfit change, gentle posing guidance the whole way, and sneak peeks within 24 hours.\n\nComplète — “The Full Story” — $650 CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, multiple outfits, two locations if you like, and your private online gallery.\n\nGood to know\nExtra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.",
    "points": [
      "A portrait session guided at your pace",
      "A mix of candid and gently directed images",
      "Gentle posing guidance — no experience needed",
      "A private gallery of finished photographs",
      "25 to 100+ edited photos, depending on your package",
      "Sneak peeks within 24–48 hours"
    ]
  },
  "fr": {
    "title": "Photographie de portraits",
    "shortDescription": "Chaque visage raconte une histoire.",
    "description": "Des portraits, magnifiquement capturés — un cadeau pour vous-même. Cette séance s’adresse à toute personne qui souhaite se célébrer, telle qu’elle est. Pour un nouveau chapitre, un anniversaire, un moment à garder en mémoire — ou simplement pour le plaisir de passer devant l’objectif, pour une fois. Aucune expérience nécessaire : je vous guide en douceur, dans une lumière douce et flatteuse, et nous prenons le temps de nous détendre pour obtenir des photos qui vous ressemblent sous votre meilleur jour. Chaque visage raconte une histoire — et toutes les beautés ont leur place ici.",
    "duration": "45 minutes à 2 heures",
    "priceRange": "Mini — 250 $ · Signature — 450 $ · Complète — 650 $ (CAD)",
    "details": "Mini — « First Look » — 250 $ CAD\nIdéal pour une première expérience de portrait. 45 minutes de prise de vue en douceur, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « The Rediscovery » — 450 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un changement de tenue, des conseils de pose tout en douceur et un aperçu sous 24 heures.\n\nComplète — « The Full Story » — 650 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs tenues, deux lieux si vous le souhaitez et votre galerie privée en ligne.\n\nBon à savoir\nHeure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.",
    "points": [
      "Une séance portrait guidée à votre rythme",
      "Un mélange de photos spontanées et de portraits doucement dirigés",
      "Des conseils de pose en douceur — aucune expérience nécessaire",
      "Une galerie privée de photographies retouchées",
      "De 25 à plus de 100 photos retouchées, selon le forfait",
      "Un aperçu sous 24 à 48 heures"
    ]
  }
}'))
UPDATE site_services
SET copy_json = json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com')
  AND COALESCE(copy_json, '{}') <> json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested));

-- couples
WITH requested(copy) AS (VALUES ('{
  "en": {
    "title": "Couples Photography",
    "shortDescription": "Love and laughter.",
    "description": "Couples, beautifully captured — love and laughter, just as you are. No anniversary needed, no occasion required. This session is simply time together, in a place that feels like you: walking, laughing, holding hands, being yourselves. I photograph you naturally, with gentle guidance when you need it and no stiff posing — just the two of you, the way you are when nobody''s watching.",
    "duration": "45 minutes to 2 hours",
    "priceRange": "Mini — $300 · Signature — $450 · Complète — $650 (CAD)",
    "details": "Mini — “First Date” — $300 CAD\nPerfect for a simple session together. 45 minutes of relaxed coverage, 25+ edited photos in your private online gallery, with sneak peeks within 48 hours.\n\nSignature — “Love & Laughter” — $450 CAD\nOur most popular. 1.5 hours, 60+ edited photos, one location of your choice, gentle guidance the whole way, and sneak peeks within 24 hours.\n\nComplète — “Your Story” — $650 CAD\nFor the full experience. Up to 2 hours, 100+ edited photos, multiple locations or outfits, and your private online gallery.\n\nGood to know\nPerfect for anniversaries, engagements, or just because — no occasion needed. Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.",
    "points": [
      "Time together in a place that feels like you",
      "Natural moments and relaxed portraits",
      "A private gallery to share your story",
      "25 to 100+ edited photos, depending on your package",
      "Sneak peeks within 24–48 hours"
    ]
  },
  "fr": {
    "title": "Photographie de couples",
    "shortDescription": "De l’amour et des rires.",
    "description": "Les couples, magnifiquement capturés — de l’amour et des rires, tels que vous êtes. Pas besoin d’anniversaire ni d’occasion particulière. Cette séance est simplement un moment à deux, dans un lieu qui vous ressemble : marcher, rire, vous tenir la main, être vous-mêmes. Je vous photographie naturellement, avec des conseils en douceur quand vous en avez besoin et sans poses figées — juste vous deux, comme lorsque personne ne vous regarde.",
    "duration": "45 minutes à 2 heures",
    "priceRange": "Mini — 300 $ · Signature — 450 $ · Complète — 650 $ (CAD)",
    "details": "Mini — « First Date » — 300 $ CAD\nIdéal pour une séance simple à deux. 45 minutes de prise de vue détendue, plus de 25 photos retouchées dans votre galerie privée en ligne et un aperçu sous 48 heures.\n\nSignature — « Love & Laughter » — 450 $ CAD\nNotre forfait le plus populaire. Une heure et demie, plus de 60 photos retouchées, un lieu de votre choix, des conseils en douceur tout au long de la séance et un aperçu sous 24 heures.\n\nComplète — « Your Story » — 650 $ CAD\nPour l’expérience complète. Jusqu’à deux heures, plus de 100 photos retouchées, plusieurs lieux ou tenues et votre galerie privée en ligne.\n\nBon à savoir\nParfait pour un anniversaire de couple, des fiançailles ou simplement pour le plaisir — aucune occasion nécessaire. Heure supplémentaire : 100 $. Déplacements inclus sur la Rive-Sud. Acompte de 50 % pour réserver votre date.",
    "points": [
      "Un moment à deux dans un lieu qui vous ressemble",
      "Des moments naturels et des portraits détendus",
      "Une galerie privée pour partager votre histoire",
      "De 25 à plus de 100 photos retouchées, selon le forfait",
      "Un aperçu sous 24 à 48 heures"
    ]
  }
}'))
UPDATE site_services
SET copy_json = json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested)),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com')
  AND COALESCE(copy_json, '{}') <> json_patch(COALESCE(copy_json, '{}'), (SELECT copy FROM requested));

-- The family session already has this name live; keep the rename explicit.
UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.title', 'Portraits & families', '$.fr.title', 'Portraits et familles'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'family' AND copy_json IS NOT NULL
  AND (json_extract(copy_json, '$.en.title') IS NOT 'Portraits & families'
    OR json_extract(copy_json, '$.fr.title') IS NOT 'Portraits et familles')
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1
    AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');
