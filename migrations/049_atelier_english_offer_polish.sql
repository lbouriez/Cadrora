-- Approved A13 copy polish. Match each original field independently; preserve owner edits.
-- Prices, package contents, FR copy, media, placement and settings are unchanged.

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[0].price', 'CAD $350'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_extract(copy_json, '$.en.tariffs[0].price') = '350 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[1].price', 'CAD $500'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_extract(copy_json, '$.en.tariffs[1].price') = '500 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[2].price', 'CAD $750'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_extract(copy_json, '$.en.tariffs[2].price') = '750 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.priceRange', 'Mini — CAD $350 · Signature — CAD $500 · Complete — CAD $750'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_extract(copy_json, '$.en.priceRange') = 'Mini — 350 $ · Signature — 500 $ · Complète — 750 $ (CAD)'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.goodToKnow', 'Best scheduled between 28 and 34 weeks of pregnancy. Extra hour: CAD $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'maternity' AND json_extract(copy_json, '$.en.goodToKnow') = 'Best scheduled between 28 and 34 weeks of pregnancy. Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date.'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.title', 'Portrait photography'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.title') = 'Portraits Photography'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[0].price', 'CAD $250'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.tariffs[0].price') = '$250 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[1].price', 'CAD $450'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.tariffs[1].price') = '$450 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[2].price', 'CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.tariffs[2].price') = '$650 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.priceRange', 'Mini — CAD $250 · Signature — CAD $450 · Complete — CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.priceRange') = 'Mini — $250 · Signature — $450 · Complète — $650 (CAD)'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.goodToKnow', 'Extra hour: CAD $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'portrait' AND json_extract(copy_json, '$.en.goodToKnow') = 'Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.title', 'Couples photography'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.title') = 'Couples Photography'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[0].price', 'CAD $300'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.tariffs[0].price') = '$300 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[1].price', 'CAD $450'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.tariffs[1].price') = '$450 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[2].price', 'CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.tariffs[2].price') = '$650 CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.priceRange', 'Mini — CAD $300 · Signature — CAD $450 · Complete — CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.priceRange') = 'Mini — $300 · Signature — $450 · Complète — $650 (CAD)'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.goodToKnow', 'Perfect for anniversaries, engagements, or just because — no occasion needed. Extra hour: CAD $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'couples' AND json_extract(copy_json, '$.en.goodToKnow') = 'Perfect for anniversaries, engagements, or just because — no occasion needed. Extra hour: $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[0].price', 'CAD $250'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea' AND json_extract(copy_json, '$.en.tariffs[0].price') = '250 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[1].price', 'CAD $450'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea' AND json_extract(copy_json, '$.en.tariffs[1].price') = '450 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.tariffs[2].price', 'CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea' AND json_extract(copy_json, '$.en.tariffs[2].price') = '650 $ CAD'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.priceRange', 'Mini — CAD $250 · Signature — CAD $450 · Complete — CAD $650'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea' AND json_extract(copy_json, '$.en.priceRange') = 'Mini — 250 $ · Signature — 450 $ · Complète — 650 $ (CAD)'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');

UPDATE site_services
SET copy_json = json_set(copy_json, '$.en.goodToKnow', 'Extra hour: CAD $100. Travel included in the Rive-Sud. 50% deposit to reserve your date.'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '5beb3b68-3389-423b-be37-142851a2a2ea' AND json_extract(copy_json, '$.en.goodToKnow') = 'Extra hour: 100 $. Travel included in the Rive-Sud. 50% deposit to reserve your date.'
  AND EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND site_name = 'Atelier Giulia' AND contact_email = 'photos@ateliergiulia.com');
