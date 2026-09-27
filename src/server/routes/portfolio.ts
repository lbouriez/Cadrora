import type { Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import { SERVICE_VARIANT_WIDTHS } from '../../shared/constants';
import { IdSchema, SlugSchema } from '../../shared/schemas';
import {
  CreatePortfolioCategorySchema, CreatePortfolioCollectionSchema, CreatePortfolioItemSchema, DeletePortfolioItemResponseSchema, PortfolioAltSchema,
  PortfolioCategoriesSchema, PortfolioCategorySchema,
  PortfolioCollectionDetailSchema, PortfolioCollectionTextSchema, PortfolioCollectionsSchema,
  PortfolioItemSchema, PortfolioItemsSchema, PortfolioVariantSchema, UpdatePortfolioCollectionSchema, UpdatePortfolioItemSchema,
} from '../../shared/schemas/portfolio';
import type { PortfolioCollection, PortfolioItem } from '../../shared/schemas/portfolio';
import { ServiceImageUploadHeadersSchema, ServiceImageUploadResponseSchema } from '../../shared/schemas/services';
import { applyCachePolicy } from '../middleware/cacheHeaders';
import { contentTypeWithoutParameters, putVerifiedImage } from '../services/imageUpload';
import { effectiveQuotaLimits, storedMediaBytes } from '../services/quotas';
import type { AppEnv } from '../types';

interface PhotoRow {
  id: string;
  collection_id: string;
  alt_json: string;
  sort_order: number;
  state: 'pending' | 'published';
}

interface CollectionRow {
  id: string;
  slug: string;
  category_id: string;
  copy_json: string;
  sort_order: number;
  published: number;
  cover_photo_id: string | null;
}

interface VariantRow {
  photo_id: string;
  variant: string;
  storage_key: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  checksum_sha256: string;
}

const requiredVariants = ['preview', 'small', 'medium', 'large'] as const;

interface CategoryRow { id: string; copy_json: string }

function requireOwner(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
}

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

async function photoRow(db: D1Database, id: string): Promise<PhotoRow | null> {
  return db.prepare('SELECT id, collection_id, alt_json, sort_order, state FROM portfolio_photos WHERE id = ?')
    .bind(id).first<PhotoRow>();
}

async function variantsForPhotos(db: D1Database, photoIds: string[]): Promise<Map<string, VariantRow[]>> {
  const grouped = new Map<string, VariantRow[]>();
  if (!photoIds.length) return grouped;
  const placeholders = photoIds.map(() => '?').join(', ');
  const rows = await db.prepare(`SELECT photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256
    FROM portfolio_variants WHERE photo_id IN (${placeholders}) ORDER BY photo_id, width`).bind(...photoIds).all<VariantRow>();
  for (const variant of rows.results) {
    const group = grouped.get(variant.photo_id) ?? [];
    group.push(variant);
    grouped.set(variant.photo_id, group);
  }
  return grouped;
}

function imageSources(photoId: string, variants: VariantRow[]) {
  return variants.map((variant) => ({
    url: `/portfolio-media/${photoId}/${variant.variant}`, width: variant.width, height: variant.height,
  }));
}

function portfolioItems(photos: PhotoRow[], variants: Map<string, VariantRow[]>): PortfolioItem[] {
  return PortfolioItemsSchema.parse(photos.map((photo) => ({
    id: photo.id, collectionId: photo.collection_id, alt: PortfolioAltSchema.parse(JSON.parse(photo.alt_json) as unknown),
    sortOrder: photo.sort_order, state: photo.state,
    imageSources: imageSources(photo.id, variants.get(photo.id) ?? []),
  })));
}

async function listPortfolio(db: D1Database, admin: boolean): Promise<PortfolioItem[]> {
  const photos = await db.prepare(`SELECT p.id, p.collection_id, p.alt_json, p.sort_order, p.state FROM portfolio_photos p
    JOIN portfolio_collections c ON c.id = p.collection_id
    WHERE ? = 1 OR (p.state = 'published' AND c.published = 1)
    ORDER BY c.sort_order, p.sort_order, p.id LIMIT 200`).bind(Number(admin)).all<PhotoRow>();
  return portfolioItems(photos.results, await variantsForPhotos(db, photos.results.map((photo) => photo.id)));
}

async function item(db: D1Database, id: string): Promise<PortfolioItem | null> {
  const photo = await photoRow(db, id);
  if (!photo) return null;
  const variants = await variantsForPhotos(db, [photo.id]);
  return portfolioItems([photo], variants)[0] ?? null;
}

function coverPhoto(row: CollectionRow, photos: PhotoRow[]): PhotoRow | undefined {
  return photos.find((photo) => photo.id === row.cover_photo_id && photo.state === 'published')
    ?? photos.find((photo) => photo.state === 'published');
}

function collection(row: CollectionRow, photoCount: number, cover: PhotoRow | undefined,
  variants: Map<string, VariantRow[]>): PortfolioCollection {
  return {
    id: row.id, slug: row.slug, categoryId: row.category_id,
    copy: PortfolioCollectionTextSchema.parse(JSON.parse(row.copy_json) as unknown),
    sortOrder: row.sort_order, published: row.published === 1, coverPhotoId: row.cover_photo_id,
    coverSources: cover ? imageSources(cover.id, variants.get(cover.id) ?? []) : [], photoCount,
  };
}

async function listCollections(db: D1Database, admin: boolean): Promise<PortfolioCollection[]> {
  const rows = await db.prepare(`SELECT c.id, c.slug, c.category_id, c.copy_json, c.sort_order, c.published, c.cover_photo_id
    FROM portfolio_collections c ${admin ? '' : 'WHERE c.published = 1'}
    ORDER BY c.sort_order, c.id LIMIT 100`).all<CollectionRow>();
  if (!rows.results.length) return PortfolioCollectionsSchema.parse([]);
  const placeholders = rows.results.map(() => '?').join(', ');
  const photos = await db.prepare(`SELECT id, collection_id, alt_json, sort_order, state FROM portfolio_photos
    WHERE collection_id IN (${placeholders}) ${admin ? '' : "AND state = 'published'"}
    ORDER BY collection_id, sort_order, id LIMIT 200`).bind(...rows.results.map((row) => row.id)).all<PhotoRow>();
  const grouped = new Map<string, PhotoRow[]>();
  for (const photo of photos.results) {
    const group = grouped.get(photo.collection_id) ?? [];
    group.push(photo);
    grouped.set(photo.collection_id, group);
  }
  const covers = rows.results.map((row) => coverPhoto(row, grouped.get(row.id) ?? []));
  const variants = await variantsForPhotos(db, covers.filter((cover): cover is PhotoRow => cover !== undefined).map((cover) => cover.id));
  return PortfolioCollectionsSchema.parse(rows.results.map((row, index) =>
    collection(row, grouped.get(row.id)?.length ?? 0, covers[index], variants)));
}

async function collectionDetail(db: D1Database, identifier: string, admin: boolean) {
  const row = await db.prepare(`SELECT id, slug, category_id, copy_json, sort_order, published, cover_photo_id
    FROM portfolio_collections WHERE ${admin ? 'id' : 'slug'} = ?${admin ? '' : ' AND published = 1'}`)
    .bind(identifier).first<CollectionRow>();
  if (!row) return null;
  const photoRows = await db.prepare(`SELECT id, collection_id, alt_json, sort_order, state FROM portfolio_photos
    WHERE collection_id = ? ${admin ? '' : "AND state = 'published'"} ORDER BY sort_order, id LIMIT 200`)
    .bind(row.id).all<PhotoRow>();
  const variants = await variantsForPhotos(db, photoRows.results.map((photo) => photo.id));
  const photos = portfolioItems(photoRows.results, variants);
  return PortfolioCollectionDetailSchema.parse({
    ...collection(row, photos.length, coverPhoto(row, photoRows.results), variants), photos,
  });
}

async function requireCategory(db: D1Database, id: string): Promise<void> {
  const category = await db.prepare('SELECT id FROM portfolio_categories WHERE id = ?')
    .bind(id).first<{ id: string }>();
  if (!category) throw new ApiException('PORTFOLIO_CATEGORY_NOT_FOUND', 'errors.routeNotFound', 404);
}

async function listCategories(db: D1Database) {
  const rows = await db.prepare('SELECT id, copy_json FROM portfolio_categories ORDER BY id LIMIT 100').all<CategoryRow>();
  return PortfolioCategoriesSchema.parse(rows.results.map((row) => ({ id: row.id, copy: JSON.parse(row.copy_json) as unknown })));
}

function deletionJob(db: D1Database, photoId: string, keys: string[], now: string): D1PreparedStatement {
  return db.prepare(`INSERT INTO maintenance_jobs
    (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
    VALUES (?, 'delete_portfolio_media', 'pending', ?, ?, 0, ?, ?, ?)`)
    .bind(crypto.randomUUID(), JSON.stringify({ photoId, storageKeys: keys }),
      `portfolio-media:${photoId}`, new Date(Date.parse(now) + 5 * 60_000).toISOString(), now, now);
}

export function registerPortfolioRoutes(app: Hono<AppEnv>): void {
  app.get('/api/v1/portfolio/categories', async (context) => {
    applyCachePolicy(context, 'event-public');
    return context.json(PortfolioCategoriesSchema.parse(await listCategories(context.env.DB)));
  });

  app.get('/api/v1/portfolio', async (context) => {
    applyCachePolicy(context, 'event-public');
    return context.json(PortfolioCollectionsSchema.parse(await listCollections(context.env.DB, false)));
  });

  app.get('/api/v1/portfolio/:slug', async (context) => {
    const slug = SlugSchema.safeParse(context.req.param('slug'));
    if (!slug.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const collection = await collectionDetail(context.env.DB, slug.data, false);
    if (!collection) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 404);
    applyCachePolicy(context, 'event-public');
    return context.json(PortfolioCollectionDetailSchema.parse(collection));
  });

  app.get('/api/v1/admin/portfolio/collections', async (context) => {
    requireAdmin(context); applyCachePolicy(context, 'admin');
    return context.json(PortfolioCollectionsSchema.parse(await listCollections(context.env.DB, true)));
  });

  app.get('/api/v1/admin/portfolio/categories', async (context) => {
    requireAdmin(context); applyCachePolicy(context, 'admin');
    return context.json(PortfolioCategoriesSchema.parse(await listCategories(context.env.DB)));
  });

  app.post('/api/v1/admin/portfolio/categories', async (context) => {
    requireOwner(context); applyCachePolicy(context, 'admin');
    const input = CreatePortfolioCategorySchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS value FROM portfolio_categories').first<{ value: number }>();
    if ((count?.value ?? 0) >= 100) throw new ApiException('PORTFOLIO_CATEGORIES_FULL', 'errors.invalidRequest', 409);
    const category = PortfolioCategorySchema.parse({ id: crypto.randomUUID(), copy: input.data.copy });
    const now = new Date().toISOString();
    await context.env.DB.prepare('INSERT INTO portfolio_categories (id, copy_json, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(category.id, JSON.stringify(category.copy), now, now).run();
    return context.json(category, 201);
  });

  app.post('/api/v1/admin/portfolio/collections', async (context) => {
    requireOwner(context); applyCachePolicy(context, 'admin');
    const input = CreatePortfolioCollectionSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    await requireCategory(context.env.DB, input.data.categoryId);
    const duplicate = await context.env.DB.prepare('SELECT id FROM portfolio_collections WHERE slug = ?')
      .bind(input.data.slug).first<{ id: string }>();
    if (duplicate) throw new ApiException('PORTFOLIO_SLUG_CONFLICT', 'errors.invalidRequest', 409);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS value FROM portfolio_collections').first<{ value: number }>();
    if ((count?.value ?? 0) >= 100) throw new ApiException('PORTFOLIO_FULL', 'errors.invalidRequest', 409);
    const order = await context.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM portfolio_collections')
      .first<{ value: number }>();
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await context.env.DB.prepare(`INSERT INTO portfolio_collections
      (id, slug, category_id, copy_json, sort_order, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)`).bind(id, input.data.slug, input.data.categoryId,
      JSON.stringify(input.data.copy), order?.value ?? 0, now, now).run();
    const created = await collectionDetail(context.env.DB, id, true);
    if (!created) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(PortfolioCollectionDetailSchema.parse(created), 201);
  });

  app.get('/api/v1/admin/portfolio/collections/:id', async (context) => {
    requireAdmin(context); applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    if (!id.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const collection = await collectionDetail(context.env.DB, id.data, true);
    if (!collection) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 404);
    return context.json(PortfolioCollectionDetailSchema.parse(collection));
  });

  app.patch('/api/v1/admin/portfolio/collections/:id', async (context) => {
    requireOwner(context); applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    const input = UpdatePortfolioCollectionSchema.safeParse(await context.req.json().catch(() => null));
    if (!id.success || !input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const current = await collectionDetail(context.env.DB, id.data, true);
    if (!current) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 404);
    await requireCategory(context.env.DB, input.data.categoryId);
    const duplicate = await context.env.DB.prepare('SELECT id FROM portfolio_collections WHERE slug = ? AND id <> ?')
      .bind(input.data.slug, id.data).first<{ id: string }>();
    if (duplicate) throw new ApiException('PORTFOLIO_SLUG_CONFLICT', 'errors.invalidRequest', 409);
    if (input.data.coverPhotoId && !current.photos.some((photo) => photo.id === input.data.coverPhotoId && photo.state === 'published')) {
      throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    }
    if (input.data.published && !current.photos.some((photo) => photo.state === 'published')) {
      throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
    }
    await context.env.DB.batch([
      context.env.DB.prepare(`UPDATE portfolio_collections SET slug = ?, category_id = ?, copy_json = ?, sort_order = ?,
        published = ?, cover_photo_id = ?, updated_at = ? WHERE id = ?`)
        .bind(input.data.slug, input.data.categoryId, JSON.stringify(input.data.copy), input.data.sortOrder,
          Number(input.data.published), input.data.coverPhotoId, new Date().toISOString(), id.data),
    ]);
    const updated = await collectionDetail(context.env.DB, id.data, true);
    if (!updated) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(PortfolioCollectionDetailSchema.parse(updated));
  });

  app.delete('/api/v1/admin/portfolio/collections/:id', async (context) => {
    requireOwner(context); applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    if (!id.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const current = await collectionDetail(context.env.DB, id.data, true);
    if (!current) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 404);
    const variants = await context.env.DB.prepare(`SELECT v.photo_id, v.storage_key FROM portfolio_variants v
      JOIN portfolio_photos p ON p.id = v.photo_id WHERE p.collection_id = ?`).bind(id.data)
      .all<{ photo_id: string; storage_key: string }>();
    const keysByPhoto = new Map<string, string[]>();
    for (const variant of variants.results) {
      const keys = keysByPhoto.get(variant.photo_id) ?? [];
      keys.push(variant.storage_key);
      keysByPhoto.set(variant.photo_id, keys);
    }
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [context.env.DB.prepare('UPDATE portfolio_collections SET published = 0 WHERE id = ?').bind(id.data)];
    for (const photo of current.photos) {
      const keys = keysByPhoto.get(photo.id) ?? [];
      if (keys.length) statements.push(deletionJob(context.env.DB, photo.id, keys, now));
    }
    statements.push(context.env.DB.prepare('DELETE FROM portfolio_collections WHERE id = ?').bind(id.data));
    await context.env.DB.batch(statements);
    return context.json(DeletePortfolioItemResponseSchema.parse({ deleted: true }));
  });

  app.get('/api/v1/admin/portfolio', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    return context.json(PortfolioItemsSchema.parse(await listPortfolio(context.env.DB, true)));
  });

  app.post('/api/v1/admin/portfolio', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const input = CreatePortfolioItemSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const collection = await collectionDetail(context.env.DB, input.data.collectionId, true);
    if (!collection) throw new ApiException('PORTFOLIO_NOT_FOUND', 'errors.routeNotFound', 404);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS value FROM portfolio_photos').first<{ value: number }>();
    if ((count?.value ?? 0) >= 200) throw new ApiException('PORTFOLIO_FULL', 'errors.invalidRequest', 409);
    const order = await context.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM portfolio_photos WHERE collection_id = ?')
      .bind(collection.id).first<{ value: number }>();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await context.env.DB.prepare(`INSERT INTO portfolio_photos (id, collection_id, alt_json, sort_order, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)`).bind(id, collection.id,
      JSON.stringify(input.data.alt), order?.value ?? 0, now, now).run();
    const created = await item(context.env.DB, id);
    if (!created) throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(PortfolioItemSchema.parse(created), 201);
  });

  app.patch('/api/v1/admin/portfolio/:id', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    const input = UpdatePortfolioItemSchema.safeParse(await context.req.json().catch(() => null));
    if (!id.success || !input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    await context.env.DB.prepare('UPDATE portfolio_photos SET alt_json = ?, sort_order = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(input.data.alt), input.data.sortOrder, new Date().toISOString(), id.data).run();
    const updated = await item(context.env.DB, id.data);
    if (!updated) throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 404);
    return context.json(PortfolioItemSchema.parse(updated));
  });

  app.put('/api/v1/admin/portfolio/:id/image/:variant', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    const variant = PortfolioVariantSchema.safeParse(context.req.param('variant'));
    const headers = ServiceImageUploadHeadersSchema.safeParse({
      byteSize: context.req.header('X-Cadrora-Byte-Size'),
      checksumSha256: context.req.header('X-Cadrora-Checksum-Sha256'),
      contentType: contentTypeWithoutParameters(context.req.header('Content-Type')),
      height: context.req.header('X-Cadrora-Height'), width: context.req.header('X-Cadrora-Width'),
    });
    if (!id.success || !variant.success || !headers.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    if (headers.data.width > SERVICE_VARIANT_WIDTHS[variant.data]) {
      throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
    }
    const photo = await photoRow(context.env.DB, id.data);
    if (!photo || photo.state !== 'pending') throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 404);
    const existing = await context.env.DB.prepare('SELECT * FROM portfolio_variants WHERE photo_id = ? AND variant = ?')
      .bind(id.data, variant.data).first<VariantRow>();
    if (existing && (existing.checksum_sha256 !== headers.data.checksumSha256 || existing.byte_size !== headers.data.byteSize ||
      existing.content_type !== headers.data.contentType || existing.width !== headers.data.width || existing.height !== headers.data.height)) {
      throw new ApiException('VARIANT_CONFLICT', 'errors.invalidVariantMedia', 409);
    }
    if ((await storedMediaBytes(context.env.DB)) + (existing ? 0 : headers.data.byteSize) > (await effectiveQuotaLimits(context.env)).storageLimitBytes) {
      throw new ApiException('STORAGE_QUOTA_EXCEEDED', 'errors.storageQuotaExceeded', 413);
    }
    const extension = headers.data.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `site/portfolio/${id.data}/${variant.data}.${extension}`;
    await putVerifiedImage(context.env.MEDIA_BUCKET, context.req.raw, key, headers.data);
    const result = await context.env.DB.prepare(`INSERT INTO portfolio_variants
      (photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM portfolio_photos WHERE id = ? AND state = 'pending')
      ON CONFLICT(photo_id, variant) DO NOTHING`)
      .bind(id.data, variant.data, key, headers.data.contentType, headers.data.byteSize,
        headers.data.width, headers.data.height, headers.data.checksumSha256, new Date().toISOString(), id.data).run();
    if (!result.meta.changes && !existing) {
      await context.env.MEDIA_BUCKET.delete(key);
      throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 409);
    }
    return context.json(ServiceImageUploadResponseSchema.parse({ variant: variant.data }));
  });

  app.post('/api/v1/admin/portfolio/:id/publish', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    if (!id.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const photo = await photoRow(context.env.DB, id.data);
    if (!photo || photo.state !== 'pending') throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 404);
    const result = await context.env.DB.prepare('SELECT * FROM portfolio_variants WHERE photo_id = ?')
      .bind(id.data).all<VariantRow>();
    const ordered = requiredVariants.map((name) => result.results.find((variant) => variant.variant === name));
    if (ordered.some((variant, index) => !variant || (index > 0 && variant.width < (ordered[index - 1]?.width ?? 0)))) {
      throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
    }
    const objects = await Promise.all(ordered.map((variant) => context.env.MEDIA_BUCKET.head(variant!.storage_key)));
    if (objects.some((object, index) => !object || object.size !== ordered[index]?.byte_size ||
      object.customMetadata?.checksumSha256 !== ordered[index]?.checksum_sha256)) {
      throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
    }
    await context.env.DB.prepare("UPDATE portfolio_photos SET state = 'published', updated_at = ? WHERE id = ? AND state = 'pending'")
      .bind(new Date().toISOString(), id.data).run();
    const updated = await item(context.env.DB, id.data);
    if (!updated) throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(PortfolioItemSchema.parse(updated));
  });

  app.delete('/api/v1/admin/portfolio/:id', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    if (!id.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const photo = await photoRow(context.env.DB, id.data);
    if (!photo) throw new ApiException('PORTFOLIO_ITEM_NOT_FOUND', 'errors.routeNotFound', 404);
    const variants = await context.env.DB.prepare('SELECT storage_key FROM portfolio_variants WHERE photo_id = ?')
      .bind(id.data).all<{ storage_key: string }>();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    if (variants.results.length) statements.push(deletionJob(context.env.DB, id.data,
      variants.results.map((variant) => variant.storage_key), now));
    statements.push(context.env.DB.prepare('UPDATE portfolio_collections SET cover_photo_id = NULL WHERE cover_photo_id = ?').bind(id.data));
    statements.push(context.env.DB.prepare('DELETE FROM portfolio_photos WHERE id = ?').bind(id.data));
    await context.env.DB.batch(statements);
    return context.json(DeletePortfolioItemResponseSchema.parse({ deleted: true }));
  });

  app.get('/api/v1/admin/portfolio/:id/image/:variant', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const id = IdSchema.safeParse(context.req.param('id'));
    const variant = PortfolioVariantSchema.safeParse(context.req.param('variant'));
    if (!id.success || !variant.success) throw new ApiException('INVALID_MEDIA_PATH', 'errors.invalidMediaPath', 400);
    const media = await context.env.DB.prepare('SELECT storage_key, content_type FROM portfolio_variants WHERE photo_id = ? AND variant = ?')
      .bind(id.data, variant.data).first<Pick<VariantRow, 'storage_key' | 'content_type'>>();
    if (!media) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    const object = await context.env.MEDIA_BUCKET.get(media.storage_key);
    if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    return new Response(object.body, { headers: {
      'Cache-Control': 'private, no-store', 'Content-Length': String(object.size),
      'Content-Type': media.content_type, ETag: object.httpEtag, 'X-Content-Type-Options': 'nosniff',
    } });
  });

  app.get('/portfolio-media/:id/:variant', async (context) => {
    const id = IdSchema.safeParse(context.req.param('id'));
    const variant = PortfolioVariantSchema.safeParse(context.req.param('variant'));
    if (!id.success || !variant.success) throw new ApiException('INVALID_MEDIA_PATH', 'errors.invalidMediaPath', 400);
    const media = await context.env.DB.prepare(`SELECT v.storage_key, v.content_type, v.byte_size FROM portfolio_variants v
      JOIN portfolio_photos p ON p.id = v.photo_id JOIN portfolio_collections c ON c.id = p.collection_id
      WHERE v.photo_id = ? AND v.variant = ? AND p.state = 'published' AND c.published = 1`)
      .bind(id.data, variant.data).first<Pick<VariantRow, 'storage_key' | 'content_type' | 'byte_size'>>();
    if (!media) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    const object = await context.env.MEDIA_BUCKET.get(media.storage_key);
    if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    applyCachePolicy(context, 'media-public');
    return new Response(object.body, { headers: {
      'Cache-Control': 'public, max-age=300, must-revalidate', 'Content-Length': String(object.size),
      'Content-Type': media.content_type, ETag: object.httpEtag, 'X-Content-Type-Options': 'nosniff',
    } });
  });
}
