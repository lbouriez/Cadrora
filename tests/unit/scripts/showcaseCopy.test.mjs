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

describe('private showcase description repair', () => {
  it('keeps a customized or deliberately cleared legacy description on reseed', () => {
    const source = readFileSync(new URL('../../../demo/seed/demo.sql', import.meta.url), 'utf8');
    const eventSeed = source.slice(source.indexOf('INSERT INTO events ('), source.indexOf('-- Localized gallery copy'));
    const columns = eventSeed.split('(')[1].split(')')[0].split(',').map(column => `${column.trim()} TEXT${column.trim() === 'id' ? ' PRIMARY KEY' : ''}`);
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`CREATE TABLE events (${columns.join(',')}, offline_at TEXT)`);
      db.exec(eventSeed);
      for (const description of [null, 'My description']) {
        db.prepare("UPDATE events SET title = 'My title', description = ? WHERE id = 'demo-private'").run(description);
        db.exec(eventSeed);
        const saved = db.prepare("SELECT title, description FROM events WHERE id = 'demo-private'").get();
        expect(saved.title).toBe('My title');
        expect(saved.description).toBe(description);
      }
    } finally { db.close(); }
  });

  const repair = readFileSync(new URL('../../../demo/seed/demo.sql', import.meta.url), 'utf8')
    .split('-- Repair only known private-demo descriptions;')[1].split('-- End private-demo copy repair.')[0]
    .replace(/^[^\n]*\n/u, '');
  const oldCopy = {
    fr: { title: 'Titre choisi', description: 'Galerie privée de démonstration. Mot de passe : cadrora-demo. Les personnes représentées sont fictives et ne sont pas de vrais clients.' },
    en: { title: 'Chosen title', description: 'Private demonstration gallery. Password: cadrora-demo. The people shown are fictional and are not real clients.' },
  };

  function applyPrivateRepair(siteName, copy) {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE site_settings (id INTEGER PRIMARY KEY, site_name TEXT); CREATE TABLE events (id TEXT PRIMARY KEY, localized_copy TEXT)');
      db.prepare('INSERT INTO site_settings VALUES (1, ?)').run(siteName);
      db.prepare('INSERT INTO events VALUES (?, ?)').run('demo-private', JSON.stringify(copy));
      db.exec(repair);
      const first = db.prepare('SELECT localized_copy FROM events').get().localized_copy;
      db.exec(repair);
      expect(db.prepare('SELECT localized_copy FROM events').get().localized_copy).toBe(first);
      return JSON.parse(first);
    } finally { db.close(); }
  }

  it('removes credentials only from known descriptions and preserves both edited titles', () => {
    const repaired = applyPrivateRepair('Cadrora', oldCopy);
    expect(JSON.stringify(repaired)).not.toContain('cadrora-demo');
    expect(repaired.fr.title).toBe(oldCopy.fr.title);
    expect(repaired.en.title).toBe(oldCopy.en.title);
  });

  it('keeps independent owner edits and does not touch other studio profiles', () => {
    const edited = { ...oldCopy, fr: { ...oldCopy.fr, description: 'Ma description.' } };
    expect(applyPrivateRepair('Cadrora', edited).fr.description).toBe('Ma description.');
    expect(applyPrivateRepair('Atelier Giulia', oldCopy)).toEqual(oldCopy);
  });
});
