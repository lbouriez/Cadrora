import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../demo/seed/demo.sql', import.meta.url), 'utf8')
  .split('-- Populate fictional showcase coordinates')[0];
const previous = {
  fr: { description: 'Cadrora, photographie d’événements et galeries privées élégantes.', footerTagline: 'Des photographies faites pour durer.' },
  en: { description: 'Cadrora, event photography and elegant private galleries.', footerTagline: 'Photographs made to be remembered.' },
};

function applySeed(siteName, copy) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE site_settings (id INTEGER PRIMARY KEY, site_name TEXT, site_copy TEXT)');
    db.prepare('INSERT INTO site_settings VALUES (1, ?, ?)').run(siteName, copy === null ? null : JSON.stringify(copy));
    db.exec(sql);
    const first = db.prepare('SELECT site_copy FROM site_settings').get().site_copy;
    db.exec(sql);
    expect(db.prepare('SELECT site_copy FROM site_settings').get().site_copy).toBe(first);
    return first === null ? null : JSON.parse(first);
  } finally { db.close(); }
}

describe('showcase brand copy repair', () => {
  it('repairs old descriptions and footers and seeds the same copy for a new showcase', () => {
    const repaired = applySeed('Cadrora', previous);
    expect(repaired).toEqual(applySeed('Cadrora', null));
    expect(repaired.en.description).toContain('your own Cloudflare account');
    expect(repaired.fr.footerTagline).toBe('Votre site photo et vos galeries.');
  });

  it('preserves independently customized fields', () => {
    const edited = { ...previous, fr: { ...previous.fr, description: 'Une description personnalisée.' } };
    const repaired = applySeed('Cadrora', edited);
    expect(repaired.fr.description).toBe(edited.fr.description);
    expect(repaired.en.footerTagline).toBe('Your photography website and galleries.');
  });

  it('does not modify Atelier Giulia or any other studio, even with the old demo values', () => {
    for (const name of ['Atelier Giulia', 'My studio']) {
      expect(applySeed(name, previous)).toEqual(previous);
      expect(applySeed(name, null)).toBeNull();
    }
  });
});
