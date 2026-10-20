import { describe, expect, it } from 'vitest';
import { resources } from '../../../src/app/i18n/resources';
import { publicResources } from '../../../src/app/public/i18n';
import { findResources } from '../../../src/app/public/FindI18n';
import { adminResourceFragment } from '../../../src/app/admin/resources';
import { adminImportResources } from '../../../src/app/admin/ImportResources';
import { aboutResources } from '../../../src/app/admin/aboutResources';
import { homeHeroResources } from '../../../src/app/admin/homeHeroResources';
import { portfolioResources } from '../../../src/app/admin/portfolioResources';
import { publicationResources } from '../../../src/app/admin/publicationResources';
import { serviceEditorResources } from '../../../src/app/admin/serviceEditorResources';
import startupResources from '../../../src/shared/i18n/publicStartup.json';
import { cadroraSite } from '../../../sites/cadrora/site';
import { atelierGiuliaSite } from '../../../sites/atelier-giulia/site';
import { studioSite } from '../../../sites/studio/site';

function leaves(value: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]]
      : child && typeof child === 'object' ? Object.entries(leaves(child as object, path)) : [];
  }));
}

describe('French and English copy contracts', () => {
  for (const [name, translations] of Object.entries({
    resources, publicResources, findResources, adminResourceFragment, adminImportResources,
    aboutResources, homeHeroResources, portfolioResources, publicationResources,
    serviceEditorResources, startupResources,
    cadrora: cadroraSite.copy, atelier: atelierGiuliaSite.copy, studio: studioSite.copy,
  })) {
    it(`${name} has matching keys and interpolation variables`, () => {
      const en = leaves(translations.en);
      const fr = leaves(translations.fr);
      expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        const variables = (text: string) => [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/gu)].map((match) => match[1]).sort();
        expect(variables(fr[key]!), key).toEqual(variables(en[key]!));
        expect(fr[key], key).not.toMatch(/\uFFFD|Ã©|â€™/u);
      }
    });
  }
});
