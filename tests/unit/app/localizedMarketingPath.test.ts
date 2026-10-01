import { describe, expect, it } from 'vitest';

import { localizedMarketingPath } from '../../../src/app/public/localizedMarketingPath';

describe('localized public destinations', () => {
  it('prefixes indexable pages and portfolio collections while preserving view state', () => {
    expect(localizedMarketingPath('/portfolio/marques?photo=cover#photos', 'en'))
      .toBe('/en/portfolio/marques?photo=cover#photos');
    expect(localizedMarketingPath('/contact?session=family', 'fr'))
      .toBe('/fr/contact?session=family');
    expect(localizedMarketingPath('/', 'en')).toBe('/en');
  });

  it('leaves customer links, external links, and existing locale prefixes intact', () => {
    expect(localizedMarketingPath('/e/private-gallery', 'en')).toBe('/e/private-gallery');
    expect(localizedMarketingPath('//other.example.test/path', 'fr')).toBe('//other.example.test/path');
    expect(localizedMarketingPath('/fr/portfolio/marques', 'en')).toBe('/fr/portfolio/marques');
  });
});
