// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { defaultServiceImage, fallbackServices, serviceText } from '../../../src/app/public/serviceCatalog';

beforeAll(() => installPublicResources(i18n));

describe('prefilled sessions', () => {
  it('keeps Family distinct from Portraits with a family cover and bilingual copy', () => {
    const family = fallbackServices().find((card) => card.id === 'family');
    expect(family).toBeDefined();
    if (!family) return;

    expect(defaultServiceImage(family.id)).toBe('/brand/service-family.webp');
    expect(serviceText(family, 'en', (key) => i18n.getFixedT('en')(key))).toMatchObject({
      title: 'Family',
      points: ['At home or outdoors, at your family’s pace', 'Time together across ages and generations', 'A private gallery to revisit and share'],
    });
    expect(serviceText(family, 'fr', (key) => i18n.getFixedT('fr')(key))).toMatchObject({
      title: 'Famille',
      points: ['À la maison ou dehors, au rythme de votre famille', 'Des moments ensemble, d’une génération à l’autre', 'Une galerie privée à revoir et à partager'],
    });
  });

  it('includes distinct Maternity, Portraits, and Couples examples in both languages', () => {
    const cards = fallbackServices();
    const additions = cards.slice(-3);
    expect(additions.map((card) => card.id)).toEqual(['maternity', 'portrait', 'couples']);
    expect(additions.every((card) => card.enabled && card.showOnHome)).toBe(true);
    expect(additions.map((card) => defaultServiceImage(card.id))).toEqual([
      '/brand/service-maternity.webp', '/brand/service-portrait.webp', '/brand/service-couples.webp',
    ]);

    expect(additions.map((card) => serviceText(card, 'en', (key) => i18n.getFixedT('en')(key))))
      .toMatchObject([
        { title: 'Maternity', shortDescription: 'The beauty of becoming', duration: '', priceRange: '' },
        { title: 'Portraits', shortDescription: 'Every face tells a story', duration: '', priceRange: '' },
        { title: 'Couples', shortDescription: 'Love and laugh', duration: '', priceRange: '' },
      ]);
    expect(additions.map((card) => serviceText(card, 'fr', (key) => i18n.getFixedT('fr')(key))))
      .toMatchObject([
        { title: 'Maternité', shortDescription: 'La beauté de devenir mère' },
        { title: 'Portraits', shortDescription: 'Chaque visage raconte une histoire' },
        { title: 'Couples', shortDescription: 'Love and laugh' },
      ]);
  });
});
