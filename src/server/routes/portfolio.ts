import type { Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import { SERVICE_VARIANT_WIDTHS } from '../../shared/constants';
import { IdSchema, SlugSchema } from '../../shared/schemas';
import {
  CreatePortfolioCollectionSchema, CreatePortfolioItemSchema, DeletePortfolioItemResponseSchema, PortfolioAltSchema,
  PortfolioCollectionDetailSchema, PortfolioCollectionTextSchema, PortfolioCollectionsSchema,
  PortfolioItemSchema, PortfolioItemsSchema, PortfolioVariantSchema, UpdatePortfolioCollectionSchema, UpdatePortfolioItemSchema,
} from '../../shared/schemas/portfolio';
import { ServiceImageUploadHeadersSchema, ServiceImageUploadResponseSchema } from '../../shared/schemas/services';
import { applyCachePolicy } from '../middleware/cacheHeaders';
import { contentTypeWithoutParameters, putVerifiedImage } from '../services/imageUpload';
import { effectiveQuotaLimits, storedMediaBytes } from '../services/quotas';
import type { AppEnv } from '../types';

interface PhotoRow {
  id: string;
  collection_id: string;
  service_id: string;
  alt_json: string;
  sort_order: number;
  state: 'pending' | 'published';
}

interface CollectionRow {
  id: string;
  slug: string;
  service_id: string;
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

function requireOwner(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
}

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

async function photoRow(db: D1Database, id: string): Promise<PhotoRow | null> {
  return db.prepare('SELECT id, collection_id, service_id, alt_json, sort_order, state FROM portfolio_photos WHERE id = ?')
    .bind(id).first<PhotoRow>();
}

async function listPortfolio(db: D1Database, admin: boolean) {
  const [photos, variants] = await Promise.all([
    db.prepare(`SELECT p.id, p.collection_id, p.service_id, p.alt_json, p.sort_order, p.state FROM portfolio_photos p
      JOIN site_services s ON s.id = p.service_id
      JOIN portfolio_collections c ON c.id = p.collection_id
      WHERE ? = 1 OR (p.state = 'published' AND c.published = 1 AND s.enabled = 1)
      ORDER BY s.sort_order, p.sort_order, p.id LIMIT 200`).bind(Number(admin)).all<PhotoRow>(),
    db.prepare('SELECT photo_id, variant, storage_key, content_type, byte_size, width, height, checksum_sha256 FROM portfolio_variants')
      .all<VariantRow>(),
  ]);
  return PortfolioItemsSchema.parse(photos.results.map((photo) => ({
    id: photo.id, collectionId: photo.collection_id, serviceId: photo.service_id, alt: PortfolioAltSchema.parse(JSON.parse(photo.alt_json) as unknown),
    sortOrder: photo.sort_order, state: photo.state,
    imageSources: variants.results.filter((variant) => variant.photo_id === photo.id)
      .sort((left, right) => left.width - right.width).map((variant) => ({
      url: `/portfolio-media/${photo.id}/${variant.variant}`, width: variant.width, height: variant.height,
      })),
  })));
}

async function item(db: D1Database, id: string) {
  return (await listPortfolio(db, true)).find((photo) => photo.id === id);
}

async function listCollections(db: D1Database, admin: boolean) {
  const rows = await db.prepare(`SELECT c.id, c.slug, c.service_id, c.copy_json, c.sort_order, c.published, c.cover_photo_id
    FROM portfolio_collections c JOIN site_services s ON s.id = c.service_id
    WHERE ? = 1 OR (c.published = 1 AND s.enabled = 1)
    ORDER BY c.sort_order, c.id LIMIT 100`).bind(Number(admin)).all<CollectionRow>();
  const photos = await listPortfolio(db, admin);
  return PortfolioCollectionsSchema.parse(rows.results.map((row) => {
    const members = photos.filter((photo) => photo.collectionId === row.id && (admin || photo.state === 'published'));
    const cover = members.find((photo) => photo.id === row.cover_photo_id && photo.state === 'published')
      ?? members.find((photo) => photo.state === 'published');
    return {
      id: row.id, slug: row.slug, serviceId: row.service_id,
      copy: PortfolioCollectionTextSchema.parse(JSON.parse(row.copy_json) as unknown),
      sortOrder: row.sort_order, published: row.published === 1, coverPhotoId: row.cover_photo_id,
      coverSources: cover?.imageSources ?? [], photoCount: members.length,
    };
  }));
}

async function collectionDetail(db: D1Database, identifier: string, admin: boolean) {
  const collections = await listCollections(db, admin);
  const collection = collections.find((candidate) => admin ? candidate.id === identifier : candidate.slug === identifier);
  if (!collection) return null;
  const photos = (await listPortfolio(db, admin)).filter((photo) => photo.collectionId === collection.id);
  return PortfolioCollectionDetailSchema.parse({ ...collection, photos });
}

async function requireService(db: D1Database, id: string): Promise<void> {
  const service = await db.prepare("SELECT id FROM site_services WHERE id = ? AND id <> 'home-hero'")
    .bind(id).first<{ id: string }>();
  if (!service) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 404);
}

function deletionJob(db: D1Database, photoId: string, keys: string[], now: string): D1PreparedStatement {
  return db.prepare(`INSERT INTO maintenance_jobs
    (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
    VALUES (?, 'delete_portfolio_media', 'pending', ?, ?, 0, ?, ?, ?)`)
    .bind(crypto.randomUUID(), JSON.stringify({ photoId, storageKeys: keys }),
      `portfolio-media:${photoId}`, new Date(Date.parse(now) + 5 * 60_000).toISOString(), now, now);
}

export function registerPortfolioRoutes(app: Hono<AppEnv>): void {
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

  app.post('/api/v1/admin/portfolio/collections', async (context) => {
    requireOwner(context); applyCachePolicy(context, 'admin');
    const input = CreatePortfolioCollectionSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    await requireService(context.env.DB, input.data.serviceId);
    const duplicate = await context.env.DB.prepare('SELECT id FROM portfolio_collections WHERE slug = ?')
      .bind(input.data.slug).first<{ id: string }>();
    if (duplicate) throw new ApiException('PORTFOLIO_SLUG_CONFLICT', 'errors.invalidRequest', 409);
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS value FROM portfolio_collections').first<{ value: number }>();
    if ((count?.value ?? 0) >= 100) throw new ApiException('PORTFOLIO_FULL', 'errors.invalidRequest', 409);
    const order = await context.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM portfolio_collections')
      .first<{ value: number }>();
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await context.env.DB.prepare(`INSERT INTO portfolio_collections
      (id, slug, service_id, copy_json, sort_order, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)`).bind(id, input.data.slug, input.data.serviceId,
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
    await requireService(context.env.DB, input.data.serviceId);
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
      context.env.DB.prepare(`UPDATE portfolio_collections SET slug = ?, service_id = ?, copy_json = ?, sort_order = ?,
        published = ?, cover_photo_id = ?, updated_at = ? WHERE id = ?`)
        .bind(input.data.slug, input.data.serviceId, JSON.stringify(input.data.copy), input.data.sortOrder,
          Number(input.data.published), input.data.coverPhotoId, new Date().toISOString(), id.data),
      context.env.DB.prepare('UPDATE portfolio_photos SET service_id = ? WHERE collection_id = ?')
        .bind(input.data.serviceId, id.data),
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
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [context.env.DB.prepare('UPDATE portfolio_collections SET published = 0 WHERE id = ?').bind(id.data)];
    for (const photo of current.photos) {
      const keys = variants.results.filter((row) => row.photo_id === photo.id).map((row) => row.storage_key);
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
    await context.env.DB.prepare(`INSERT INTO portfolio_photos (id, collection_id, service_id, alt_json, sort_order, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(id, collection.id, collection.serviceId,
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
      JOIN site_services s ON s.id = c.service_id
      WHERE v.photo_id = ? AND v.variant = ? AND p.state = 'published' AND c.published = 1 AND s.enabled = 1`)
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
