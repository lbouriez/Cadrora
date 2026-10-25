import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { ServiceCopySchema } from '../../../src/shared/schemas/services';

const migrationDirectory = new URL('../../../migrations/', import.meta.url);
const migration = readFileSync(new URL('047_atelier_session_content.sql', migrationDirectory), 'utf8');
const birthdayId = '5beb3b68-3389-423b-be37-142851a2a2ea';
const databases: DatabaseSync[] = [];
const oldCopy = {
  fr: { title: 'Titre existant', shortDescription: 'Court', description: 'Description', points: ['Inclus'], details: 'Informations' },
  en: { title: 'Existing title', shortDescription: 'Short', description: 'Description', points: ['Included'], details: 'Information' },
};

afterEach(() => { databases.splice(0).forEach(database => database.close()); });

function fixture(name = 'Atelier Giulia', email = 'photos@ateliergiulia.com') {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  for (const file of readdirSync(migrationDirectory).filter(file => /^\d{3}_.*\.sql$/u.test(file) && file < '047').sort()) {
    database.exec(readFileSync(new URL(file, migrationDirectory), 'utf8'));
  }
  database.prepare('UPDATE site_settings SET site_name = ?, contact_email = ? WHERE id = 1').run(name, email);
  database.prepare(`INSERT INTO site_services
    (id, is_builtin, sort_order, enabled, show_on_home, copy_json, image_revision, created_at, updated_at)
    VALUES (?, 0, 10, 1, 1, ?, 3, '2026-10-16', '2026-10-16')`).run(birthdayId, JSON.stringify(oldCopy));
  database.prepare(`UPDATE site_services SET copy_json = ?, image_revision = 3, pending_image_revision = 4,
    photo_alignment = 'top', mobile_photo_alignment = 'bottom' WHERE is_builtin = 1`).run(JSON.stringify(oldCopy));
  database.exec(`UPDATE site_services SET enabled = 0, show_on_home = 0 WHERE id = 'couples'`);
  database.prepare(`INSERT INTO site_service_variants
    (service_id, revision, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
    VALUES (?, 3, 'preview', 'birthday/preview.webp', 'image/webp', 200, 100, 100, ?, '2026-10-16')`)
    .run(birthdayId, 'a'.repeat(64));
  return database;
}

function snapshot(database: DatabaseSync) {
  return {
    settings: database.prepare('SELECT * FROM site_settings').all(),
    services: database.prepare('SELECT * FROM site_services ORDER BY id').all(),
    variants: database.prepare('SELECT * FROM site_service_variants').all(),
    schema: database.prepare('SELECT name, sql FROM sqlite_schema ORDER BY name').all(),
  };
}

function copy(database: DatabaseSync, id: string) {
  const row = database.prepare('SELECT copy_json FROM site_services WHERE id = ?').get(id);
  return ServiceCopySchema.parse(JSON.parse(String(row?.copy_json)));
}

describe('Atelier Giulia session content migration', () => {
  it('fills the existing bilingual fields and retains all media, placement, and unrelated data', () => {
    const database = fixture();
    const before = snapshot(database);
    database.exec(migration);
    const after = snapshot(database);
    expect(after.settings).toEqual(before.settings);
    expect(after.variants).toEqual(before.variants);
    expect(after.schema).toEqual(before.schema);
    expect(after.services).toHaveLength(before.services.length);
    const targetIds = [birthdayId, 'maternity', 'portrait', 'couples', 'family'];
    for (const [index, row] of after.services.entries()) {
      const original = before.services[index];
      if (!targetIds.includes(String(row.id))) expect(row).toEqual(original);
      else expect({ ...row, copy_json: original?.copy_json, updated_at: original?.updated_at }).toEqual(original);
    }
    for (const [id, count, prices, packages] of [
      [birthdayId, 6, [250, 450, 650], ['Little Moments', 'The Party', 'The Whole Celebration']],
      ['maternity', 5, [350, 500, 750], ['First Bloom', 'The Glow', 'The Whole Story']],
      ['portrait', 6, [250, 450, 650], ['First Look', 'The Rediscovery', 'The Full Story']],
      ['couples', 5, [300, 450, 650], ['First Date', 'Love & Laughter', 'Your Story']],
    ] as const) {
      const updated = copy(database, id);
      for (const language of ['fr', 'en'] as const) {
        expect(updated[language].points).toHaveLength(count);
        prices.forEach(price => expect(updated[language].priceRange).toContain(String(price)));
        packages.forEach(name => expect(updated[language].details).toContain(name));
        expect(updated[language].details).toContain(language === 'fr' ? 'Bon à savoir' : 'Good to know');
        expect(updated[language].details).toContain('Rive-Sud');
        expect(updated[language].details).toContain(language === 'fr' ? '50 %' : '50%');
        expect(Object.keys(updated[language]).sort()).toEqual(['description', 'details', 'duration', 'points', 'priceRange', 'shortDescription', 'title']);
      }
    }
    expect(copy(database, birthdayId).en.description).toHaveLength(706);
    expect(copy(database, 'maternity').en.details).toContain('between 28 and 34 weeks');
    expect(copy(database, 'family')).toEqual({
      fr: { ...oldCopy.fr, title: 'Portraits et familles' },
      en: { ...oldCopy.en, title: 'Portraits & families' },
    });
  });

  it.each([
    ['Cadrora', 'photos@ateliergiulia.com'],
    ['Atelier Giulia', 'another@example.com'],
    ['Another studio', 'another@example.com'],
  ])('does not change another installation: %s / %s', (name, email) => {
    const database = fixture(name, email);
    const before = snapshot(database);
    database.exec(migration);
    expect(snapshot(database)).toEqual(before);
  });

  it('is a no-op when reapplied and does not create missing sessions', () => {
    const database = fixture();
    database.exec(migration);
    const before = snapshot(database);
    const changes = database.prepare('SELECT total_changes() AS count').get();
    database.exec(migration);
    expect(snapshot(database)).toEqual(before);
    expect(database.prepare('SELECT total_changes() AS count').get()).toEqual(changes);
    database.exec('DELETE FROM site_service_variants; DELETE FROM site_services;');
    database.exec(migration);
    expect(snapshot(database).services).toEqual([]);
  });

  it('can populate a built-in session that still uses compiled defaults', () => {
    const database = fixture();
    database.exec("UPDATE site_services SET copy_json = NULL WHERE id = 'portrait'");
    database.exec(migration);
    expect(copy(database, 'portrait').en.shortDescription).toBe('Every face tells a story.');
  });
});
