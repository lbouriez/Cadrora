import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { runWrangler } from '../release/target.mjs';

const directory = 'demo/seed/portfolio';
const variants = ['preview', 'small', 'medium', 'large'];
const now = '2026-09-27T00:00:00.000Z';
const collections = [
  { service: 'wedding', slug: 'mariages', fr: ['Moments de mariage', 'Deux histoires fictives pour découvrir les collections du portfolio.'], en: ['Wedding moments', 'Two fictional stories introducing the portfolio collections.'], photos: [
    ['Un couple souriant dans un jardin après la cérémonie', 'A couple smiling in a garden after the ceremony'],
    ['Un échange de vœux à la lumière dorée', 'An exchange of vows in golden light'],
  ] },
  { service: 'family', slug: 'familles', fr: ['Instants en famille', 'Des scènes naturelles de vie de famille, créées pour la démonstration.'], en: ['Family moments', 'Natural family scenes created for the demonstration.'], photos: [
    ['Une famille joue ensemble dans un parc', 'A family playing together in a park'],
    ['Un parent serre son enfant près d’une fenêtre', 'A parent embraces a child by a window'],
  ] },
  { service: 'brand', slug: 'marques', fr: ['Portraits de marque', 'Des portraits d’entrepreneurs fictifs dans leur univers.'], en: ['Brand portraits', 'Portraits of fictional entrepreneurs in their element.'], photos: [
    ['Une céramiste travaille dans son atelier', 'A ceramic artist working in her studio'],
    ['Une fleuriste arrange des fleurs dans sa boutique', 'A florist arranging flowers in her shop'],
  ] },
  { service: 'corporate', slug: 'entreprises', fr: ['Vie d’équipe', 'Des moments professionnels naturels, créés pour la démonstration.'], en: ['Team life', 'Natural professional moments created for the demonstration.'], photos: [
    ['Une équipe échange autour d’une table', 'A team talking around a table'],
    ['Une présentation dans un petit bureau', 'A presentation in a small office'],
  ] },
  { service: 'children', slug: 'enfance', fr: ['Enfance en lumière', 'Des instants de jeu et de découverte entièrement fictifs.'], en: ['Childhood in light', 'Entirely fictional moments of play and discovery.'], photos: [
    ['Deux enfants courent dans un pré', 'Two children running through a meadow'],
    ['Un enfant dessine près d’une fenêtre', 'A child drawing by a window'],
  ] },
];

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** D1 metadata is derived from the exact tracked bytes uploaded to R2. */
export async function buildPortfolioSeed() {
  const sql = ['PRAGMA foreign_keys = ON;'];
  const uploads = [];
  for (const [index, collection] of collections.entries()) {
    const collectionId = `demo-portfolio-${collection.service}`;
    const copy = { fr: { title: collection.fr[0], description: collection.fr[1] },
      en: { title: collection.en[0], description: collection.en[1] } };
    sql.push(`INSERT INTO portfolio_collections (id, slug, service_id, copy_json, sort_order, published, cover_photo_id, created_at, updated_at)
      VALUES (${literal(collectionId)}, ${literal(collection.slug)}, ${literal(collection.service)}, ${literal(JSON.stringify(copy))},
        ${index}, 1, ${literal(`${collectionId}-01`)}, ${literal(now)}, ${literal(now)}) ON CONFLICT(id) DO NOTHING;`);
    for (const [photoIndex, alt] of collection.photos.entries()) {
      const photoId = `${collectionId}-${String(photoIndex + 1).padStart(2, '0')}`;
      const photoName = `${collection.service}-${String(photoIndex + 1).padStart(2, '0')}`;
      sql.push(`INSERT INTO portfolio_photos (id, collection_id, service_id, alt_json, sort_order, state, created_at, updated_at)
        VALUES (${literal(photoId)}, ${literal(collectionId)}, ${literal(collection.service)},
          ${literal(JSON.stringify({ fr: alt[0], en: alt[1] }))}, ${photoIndex}, 'published', ${literal(now)}, ${literal(now)})
        ON CONFLICT(id) DO NOTHING;`);
      for (const variant of variants) {
        const file = join(directory, `${photoName}-${variant}.webp`);
        const bytes = await readFile(file);
        const metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height || metadata.format !== 'webp') throw new Error(`Invalid portfolio seed media: ${file}`);
        const checksum = createHash('sha256').update(bytes).digest('hex');
        const key = `site/portfolio/${photoId}/${variant}.webp`;
        uploads.push({ file, key });
        sql.push(`INSERT INTO portfolio_variants
          (photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
          VALUES (${literal(photoId)}, ${literal(variant)}, ${literal(key)}, 'image/webp', ${bytes.length},
            ${metadata.width}, ${metadata.height}, ${literal(checksum)}, ${literal(now)})
          ON CONFLICT(photo_id, variant) DO UPDATE SET storage_key = excluded.storage_key,
            content_type = excluded.content_type, byte_size = excluded.byte_size,
            width = excluded.width, height = excluded.height, checksum_sha256 = excluded.checksum_sha256;`);
      }
    }
  }
  return { sql: `${sql.join('\n')}\n`, uploads };
}

export async function seedPortfolioDemo({ bucketName, configPath, environment, target, upload, execute = runWrangler }) {
  const generated = await buildPortfolioSeed();
  process.stdout.write(`Uploading ${generated.uploads.length} generated portfolio variants.\n`);
  for (const { file, key } of generated.uploads) {
    await upload([
      'r2', 'object', 'put', `${bucketName}/${key}`,
      '--file', file, '--content-type', 'image/webp', '--force', '--remote',
      '--config', configPath, ...target.migrationArgs,
    ], environment);
  }
  const sqlFile = join('.artifacts/demo', 'portfolio-records.sql');
  await mkdir('.artifacts/demo', { recursive: true });
  await writeFile(sqlFile, generated.sql, 'utf8');
  execute(['d1', 'execute', 'DB', '--remote', '--file', sqlFile, '--config', configPath, ...target.migrationArgs], environment);
}
