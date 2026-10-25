import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrations = new URL('../../../migrations/', import.meta.url);
const correction = readFileSync(new URL('045_atelier_bilingual_copy.sql', migrations), 'utf8');
const oldAbout = "I'm Giulia, an Italian girl who moved to Canada with a passion for family photography. I've always been the one grabbing the camera to capture happy moments — with a keen eye for aesthetics and, above all, making people feel at ease in front of the lens.";
const databases = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function sessionCopy(text) {
  return Object.fromEntries(['fr', 'en'].map((language) => [language, {
    title: `${language} title`, shortDescription: text, description: text,
    points: [`${language} owner point`], duration: 'Owner duration', priceRange: 'Owner price', details: 'Owner details',
  }]));
}

function fixture({ name = 'Atelier Giulia', email = 'photos@ateliergiulia.com' } = {}) {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  for (const file of readdirSync(migrations).filter((file) => /^\d{3}_.*\.sql$/u.test(file) && file < '045').sort()) {
    database.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  database.prepare(`UPDATE site_settings SET site_name = ?, contact_email = ?, about_copy = ?,
    construction_notice_enabled = 1, sessions_page_enabled = 0, theme_mode = 'light' WHERE id = 1`)
    .run(name, email, JSON.stringify({ fr: { title: 'Giulia', body: 'Owner French biography', imageAlt: 'Owner alt' },
      en: { title: 'Meet Giulia', body: oldAbout, imageAlt: 'Owner alt' } }));
  const maternity = sessionCopy('The beauty of becoming');
  maternity.fr.shortDescription = 'La beauté de devenir mère';
  maternity.fr.description = 'La beauté de devenir mère';
  for (const [id, copy] of [['maternity', maternity], ['couples', sessionCopy('Love and laugh')]]) {
    database.prepare('UPDATE site_services SET copy_json = ?, image_revision = 3 WHERE id = ?').run(JSON.stringify(copy), id);
  }
  return database;
}

function snapshot(database) {
  return {
    settings: database.prepare('SELECT * FROM site_settings WHERE id = 1').get(),
    services: database.prepare('SELECT * FROM site_services ORDER BY id').all(),
  };
}

function service(database, id) {
  return JSON.parse(database.prepare('SELECT copy_json FROM site_services WHERE id = ?').get(id).copy_json);
}

describe('Atelier bilingual copy correction migration', () => {
  it('corrects the observed text while preserving other copy, business settings and media', () => {
    const database = fixture();
    const before = snapshot(database);
    database.exec(correction);
    const after = snapshot(database);
    const about = JSON.parse(after.settings.about_copy);
    expect(about.en.body).toBe(oldAbout.replace('an Italian girl who moved to Canada', 'an Italian photographer living in Canada'));
    expect(about.fr).toEqual(JSON.parse(before.settings.about_copy).fr);
    expect(about.en.title).toBe('Meet Giulia');
    expect(about.en.imageAlt).toBe('Owner alt');
    expect(service(database, 'maternity').en).toMatchObject({
      shortDescription: 'The beauty of becoming a mother', description: 'The beauty of becoming a mother',
    });
    expect(service(database, 'maternity').fr.shortDescription).toBe('La beauté de devenir mère');
    expect(service(database, 'couples').fr).toMatchObject({ shortDescription: 'De l’amour et des rires', description: 'De l’amour et des rires' });
    expect(service(database, 'couples').en).toMatchObject({ shortDescription: 'Love and laughter', description: 'Love and laughter' });
    expect({ ...after.settings, about_copy: before.settings.about_copy, updated_at: before.settings.updated_at }).toEqual(before.settings);
    for (const [index, row] of after.services.entries()) {
      const original = before.services[index];
      expect({ ...row, copy_json: original.copy_json, updated_at: original.updated_at }).toEqual(original);
      if (!row.copy_json) continue;
      const copy = JSON.parse(row.copy_json);
      const previous = JSON.parse(original.copy_json);
      for (const language of ['fr', 'en']) {
        expect({ ...copy[language], shortDescription: previous[language].shortDescription, description: previous[language].description })
          .toEqual(previous[language]);
      }
    }
  });

  it.each([
    { name: 'Cadrora', email: 'photos@ateliergiulia.com' },
    { name: 'Atelier Giulia', email: 'other@example.com' },
    { name: 'Another studio', email: null },
  ])('leaves another installation untouched: $name / $email', (identity) => {
    const database = fixture(identity);
    const before = snapshot(database);
    database.exec(correction);
    expect(snapshot(database)).toEqual(before);
  });

  it('preserves owner edits independently in each locale and text field', () => {
    const database = fixture();
    database.exec(`UPDATE site_settings SET about_copy = json_set(about_copy, '$.en.body', 'My new biography');
      UPDATE site_services SET copy_json = json_set(copy_json,
        '$.en.shortDescription', 'My new subtitle', '$.fr.description', 'Mon nouveau texte')
      WHERE id IN ('maternity', 'couples');`);
    database.exec(correction);
    expect(JSON.parse(snapshot(database).settings.about_copy).en.body).toBe('My new biography');
    for (const id of ['maternity', 'couples']) {
      expect(service(database, id).en.shortDescription).toBe('My new subtitle');
      expect(service(database, id).fr.description).toBe('Mon nouveau texte');
    }
    expect(service(database, 'maternity').en.description).toBe('The beauty of becoming a mother');
    expect(service(database, 'couples').en.description).toBe('Love and laughter');
    expect(service(database, 'couples').fr.shortDescription).toBe('De l’amour et des rires');
  });

  it('is idempotent and does not manufacture missing owner copy', () => {
    const database = fixture();
    database.exec(correction);
    const once = snapshot(database);
    database.exec(correction);
    expect(snapshot(database)).toEqual(once);
    database.exec('UPDATE site_settings SET about_copy = NULL; UPDATE site_services SET copy_json = NULL;');
    const withoutCopy = snapshot(database);
    database.exec(correction);
    expect(snapshot(database)).toEqual(withoutCopy);
  });
});
