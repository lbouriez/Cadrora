import { describe, expect, it } from 'vitest';

import { galleryText } from '../../../src/app/public/galleryText';

describe('galleryText', () => {
  const gallery = {
    title: 'Instants en famille', description: 'Une galerie privée.',
    localizedCopy: {
      fr: { title: 'Instants en famille', description: 'Une galerie privée.' },
      en: { title: 'Family moments', description: 'A private gallery.' },
    },
  };

  it('selects the requested demo gallery language', () => {
    expect(galleryText(gallery, 'en')).toEqual(gallery.localizedCopy.en);
    expect(galleryText(gallery, 'fr-CA')).toEqual(gallery.localizedCopy.fr);
  });

  it('preserves legacy owner gallery text', () => {
    expect(galleryText({ title: 'Séance', description: null }, 'en'))
      .toEqual({ title: 'Séance', description: null });
  });
});
