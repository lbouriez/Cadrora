import { describe, expect, it } from 'vitest';

import { adminResourceFragment } from '../../../src/app/admin/resources';

function leafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object'
      ? leafKeys(child as object, path)
      : [path];
  });
}

describe('admin translations', () => {
  it('keeps the English and French resource trees aligned', () => {
    expect(leafKeys(adminResourceFragment.en).sort()).toEqual(leafKeys(adminResourceFragment.fr).sort());
  });

  it('provides the gallery deletion heading in both languages', () => {
    expect(adminResourceFragment.en.admin.events.deleteTitle).toBe('Permanently delete this gallery');
    expect(adminResourceFragment.fr.admin.events.deleteTitle).toBe('Supprimer définitivement cette galerie');
  });
});
