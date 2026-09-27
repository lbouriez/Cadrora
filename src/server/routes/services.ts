import type { Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import { SERVICE_VARIANT_WIDTHS } from '../../shared/constants';
import {
  ServiceCardSchema, ServiceCardsSchema, ServiceCardUpdateSchema, ServiceCopySchema,
  ServiceIdSchema, ServiceImageUploadHeadersSchema, ServiceVariantSchema,
  ServiceImageRevisionSchema, ServiceImageUploadResponseSchema,
} from '../../shared/schemas';
import type { ServiceCard } from '../../shared/schemas';
import { applyCachePolicy } from '../middleware/cacheHeaders';
import { contentTypeWithoutParameters, putVerifiedImage } from '../services/imageUpload';
import { effectiveQuotaLimits, storedMediaBytes } from '../services/quotas';
import { readServiceMediaCache } from '../services/publicMediaCache';
import dimensions from '../../shared/brand-photo-dimensions.json';
import type { AppEnv } from '../types';

interface ServiceRow {
  id: string;
  is_builtin: number;
  sort_order: number;
  enabled: number;
  show_on_home: number;
  copy_json: string | null;
  image_revision: number;
  pending_image_revision: number | null;
}

interface VariantRow {
  service_id: string;
  revision: number;
  variant: string;
  storage_key: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  checksum_sha256: string;
}

const MAX_SERVICES = 30;
const requiredVariants = ['preview', 'small', 'medium', 'large'] as const;

export async function oldImageCleanup(db: D1Database, id: string, revision: number, now: string): Promise<D1PreparedStatement[]> {
  if (revision < 1) return [];
  const rows = await db.prepare('SELECT storage_key FROM site_service_variants WHERE service_id = ? AND revision = ?')
    .bind(id, revision).all<{ storage_key: string }>();
  if (!rows.results.length) return [];
  const availableAt = new Date(Date.parse(now) + 5 * 60_000).toISOString();
  return [
    db.prepare(`INSERT INTO maintenance_jobs
      (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
      VALUES (?, 'delete_service_media', 'pending', ?, ?, 0, ?, ?, ?)`)
      .bind(crypto.randomUUID(), JSON.stringify({ serviceId: id, revision, storageKeys: rows.results.map((item) => item.storage_key) }),
        `service-media:${id}:${revision}`, availableAt, now, now),
    db.prepare('DELETE FROM site_service_variants WHERE service_id = ? AND revision = ?').bind(id, revision),
  ];
}

async function serviceRow(db: D1Database, id: string): Promise<ServiceRow | null> {
  return db.prepare('SELECT * FROM site_services WHERE id = ?').bind(id).first<ServiceRow>();
}

async function listServices(db: D1Database): Promise<ServiceCard[]> {
  const [cards, variants] = await Promise.all([
    db.prepare("SELECT * FROM site_services WHERE id <> 'home-hero' ORDER BY sort_order, id LIMIT 30").all<ServiceRow>(),
    db.prepare('SELECT service_id, revision, variant, storage_key, content_type, byte_size, width, height, checksum_sha256 FROM site_service_variants ORDER BY width').all<VariantRow>(),
  ]);
  return ServiceCardsSchema.parse(cards.results.map((row) => ({
    id: row.id,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    showOnHome: row.show_on_home === 1,
    copy: row.copy_json ? ServiceCopySchema.parse(JSON.parse(row.copy_json) as unknown) : null,
    imageRevision: row.image_revision || null,
    imageSources: variants.results.filter((variant) => variant.service_id === row.id && variant.revision === row.image_revision)
      .map((variant) => ({
        url: `/service-media/${row.id}/${row.image_revision}/${variant.variant}`,
        width: variant.width,
        height: variant.height,
      })),
  })));
}

function requireOwner(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (context.get('auth').admin?.access !== 'manage') {
    throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
  }
}

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
}

async function syncLegacyServices(db: D1Database): Promise<void> {
  const rows = await db.prepare('SELECT id FROM site_services WHERE is_builtin = 1 AND enabled = 1 ORDER BY sort_order, id').all<{ id: string }>();
  // The old site-settings contract requires a nonempty built-in list. Keep one
  // legacy key when all built-ins are hidden; the new catalog is authoritative.
  const keys = rows.results.map((row) => row.id);
  await db.prepare('UPDATE site_settings SET enabled_services = ? WHERE id = 1').bind(JSON.stringify(keys.length ? keys : ['wedding'])).run();
}

export function registerServiceRoutes(app: Hono<AppEnv>): void {
  app.get('/home-hero-image/:variant', async (context) => {
    const variant = ServiceVariantSchema.safeParse(context.req.param('variant'));
    if (!variant.success) throw new ApiException('INVALID_MEDIA_PATH', 'errors.invalidMediaPath', 400);
    applyCachePolicy(context, 'media-public');
    const row = await context.env.DB.prepare(
      `SELECT v.storage_key, v.content_type, v.byte_size, v.checksum_sha256, v.revision
       FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
       JOIN site_settings settings ON settings.id = 1
       WHERE v.service_id = 'home-hero' AND v.variant = ? AND v.revision = s.image_revision
         AND settings.home_hero_image_enabled = 1`,
    ).bind(variant.data).first<VariantRow>().catch(() => null);
    if (row) {
      let response: Response | null = null;
      try {
        const versionedUrl = new URL(`/service-media/home-hero/${row.revision}/${variant.data}`, context.req.url).toString();
        response = await readServiceMediaCache(context.executionCtx, versionedUrl, {
          contentType: row.content_type, serviceId: 'home-hero', revision: row.revision, storageKey: row.storage_key,
        });
      } catch { /* R2 remains the source if the edge cache is unavailable. */ }
      if (!response?.ok) {
        const object = await context.env.MEDIA_BUCKET.get(row.storage_key);
        if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
        response = new Response(object.body, { headers: {
          'Content-Length': String(object.size), 'Content-Type': row.content_type,
          ETag: object.httpEtag, 'X-Content-Type-Options': 'nosniff',
        } });
      }
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=60, must-revalidate');
      return new Response(response.body, { status: response.status, headers });
    }
    const fallback = context.env.SITE_HERO_IMAGE_URL || '/brand/demo-hero.webp';
    const photo = dimensions[fallback as keyof typeof dimensions];
    const width = SERVICE_VARIANT_WIDTHS[variant.data];
    const basename = fallback.startsWith('/brand/') && fallback.endsWith('.webp')
      ? fallback.slice('/brand/'.length, -'.webp'.length) : null;
    const path = photo && basename && width < photo.width
      ? `/brand/responsive/${basename}-${width}.webp` : fallback;
    const asset = await context.env.ASSETS.fetch(new Request(new URL(path, context.req.url)));
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', 'public, max-age=60, must-revalidate');
    return new Response(asset.body, { status: asset.status, headers });
  });

  app.get('/service-media/:id/:revision/:variant', async (context) => {
    const id = ServiceIdSchema.safeParse(context.req.param('id'));
    const variant = ServiceVariantSchema.safeParse(context.req.param('variant'));
    const revision = Number(context.req.param('revision'));
    if (!id.success || !variant.success || !Number.isSafeInteger(revision) || revision < 1) {
      throw new ApiException('INVALID_MEDIA_PATH', 'errors.invalidMediaPath', 400);
    }
    const row = await context.env.DB.prepare(
      `SELECT v.service_id, v.revision, v.variant, v.storage_key, v.content_type, v.byte_size,
              v.width, v.height, v.checksum_sha256
       FROM site_service_variants v JOIN site_services s ON s.id = v.service_id
       WHERE v.service_id = ? AND v.revision = ? AND v.variant = ? AND s.image_revision = v.revision`,
    ).bind(id.data, revision, variant.data).first<VariantRow>();
    if (!row) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    applyCachePolicy(context, 'media-public');
    try {
      const cached = await readServiceMediaCache(context.executionCtx, context.req.url, {
        contentType: row.content_type, serviceId: id.data, revision, storageKey: row.storage_key,
      });
      if (cached?.ok) return new Response(cached.body, { status: cached.status, headers: cached.headers });
    } catch {
      // An edge-cache failure cannot take a published marketing image offline.
    }
    const object = await context.env.MEDIA_BUCKET.get(row.storage_key);
    if (!object) throw new ApiException('MEDIA_NOT_FOUND', 'errors.mediaNotFound', 404);
    return new Response(object.body, { headers: {
      'Content-Length': String(object.size), 'Content-Type': row.content_type,
      ETag: object.httpEtag, 'X-Content-Type-Options': 'nosniff',
    } });
  });

  app.get('/api/v1/services', async (context) => {
    applyCachePolicy(context, 'event-public');
    const cards = await listServices(context.env.DB);
    return context.json(ServiceCardsSchema.parse(cards.filter((card) => card.enabled &&
      (card.isBuiltin || (card.copy && card.imageSources.length === requiredVariants.length)))));
  });

  app.get('/api/v1/admin/services', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    return context.json(ServiceCardsSchema.parse(await listServices(context.env.DB)));
  });

  app.post('/api/v1/admin/services', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const input = ServiceCopySchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const count = await context.env.DB.prepare("SELECT COUNT(*) AS value FROM site_services WHERE id <> 'home-hero'").first<{ value: number }>();
    if ((count?.value ?? 0) >= MAX_SERVICES) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 409);
    const order = await context.env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM site_services WHERE id <> 'home-hero'").first<{ value: number }>();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      'INSERT INTO site_services (id, is_builtin, sort_order, enabled, show_on_home, copy_json, created_at, updated_at) VALUES (?, 0, ?, 0, 0, ?, ?, ?)',
    ).bind(id, order?.value ?? 0, JSON.stringify(input.data), now, now).run();
    const card = (await listServices(context.env.DB)).find((item) => item.id === id);
    if (!card) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(ServiceCardSchema.parse(card), 201);
  });

  app.patch('/api/v1/admin/services/:id', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = ServiceIdSchema.safeParse(context.req.param('id'));
    const input = ServiceCardUpdateSchema.safeParse(await context.req.json().catch(() => null));
    if (!id.success || !input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const previous = await serviceRow(context.env.DB, id.data);
    if (!previous) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 404);
    if (id.data === 'home-hero') throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    if (input.data.enabled && !previous.is_builtin && (!input.data.copy || previous.image_revision === 0)) {
      throw new ApiException('SERVICE_INCOMPLETE', 'errors.invalidRequest', 409);
    }
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      'UPDATE site_services SET enabled = ?, show_on_home = ?, sort_order = ?, copy_json = ?, updated_at = ? WHERE id = ?',
    ).bind(Number(input.data.enabled), Number(input.data.showOnHome), input.data.sortOrder,
      input.data.copy ? JSON.stringify(input.data.copy) : null, now, id.data).run();
    if (previous.is_builtin) await syncLegacyServices(context.env.DB);
    const card = (await listServices(context.env.DB)).find((item) => item.id === id.data);
    if (!card) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(ServiceCardSchema.parse(card));
  });

  app.post('/api/v1/admin/services/:id/image-revision', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = ServiceIdSchema.safeParse(context.req.param('id'));
    if (!id.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const row = await serviceRow(context.env.DB, id.data);
    if (!row) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 404);
    const revision = (row.pending_image_revision ?? row.image_revision) + 1;
    const now = new Date().toISOString();
    await context.env.DB.batch([
      ...await oldImageCleanup(context.env.DB, id.data, row.pending_image_revision ?? 0, now),
      context.env.DB.prepare('UPDATE site_services SET pending_image_revision = ?, updated_at = ? WHERE id = ? AND pending_image_revision IS ?')
        .bind(revision, now, id.data, row.pending_image_revision),
    ]);
    return context.json(ServiceImageRevisionSchema.parse({ revision }));
  });

  app.put('/api/v1/admin/services/:id/image/:revision/:variant', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = ServiceIdSchema.safeParse(context.req.param('id'));
    const variant = ServiceVariantSchema.safeParse(context.req.param('variant'));
    const revision = Number(context.req.param('revision'));
    const headers = ServiceImageUploadHeadersSchema.safeParse({
      byteSize: context.req.header('X-Cadrora-Byte-Size'),
      checksumSha256: context.req.header('X-Cadrora-Checksum-Sha256'),
      contentType: contentTypeWithoutParameters(context.req.header('Content-Type')),
      height: context.req.header('X-Cadrora-Height'),
      width: context.req.header('X-Cadrora-Width'),
    });
    if (!id.success || !variant.success || !headers.success || !Number.isSafeInteger(revision)) {
      throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    }
    if (headers.data.width > SERVICE_VARIANT_WIDTHS[variant.data]) {
      throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
    }
    if (id.data === 'home-hero' && headers.data.width !== SERVICE_VARIANT_WIDTHS[variant.data]) {
      throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
    }
    const row = await serviceRow(context.env.DB, id.data);
    if (!row || row.pending_image_revision !== revision) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 404);
    const existing = await context.env.DB.prepare('SELECT * FROM site_service_variants WHERE service_id = ? AND revision = ? AND variant = ?')
      .bind(id.data, revision, variant.data).first<VariantRow>();
    if (existing && (existing.checksum_sha256 !== headers.data.checksumSha256 || existing.byte_size !== headers.data.byteSize ||
      existing.content_type !== headers.data.contentType || existing.width !== headers.data.width ||
      existing.height !== headers.data.height)) {
      throw new ApiException('VARIANT_CONFLICT', 'errors.invalidVariantMedia', 409);
    }
    if ((await storedMediaBytes(context.env.DB)) + (existing ? 0 : headers.data.byteSize) > (await effectiveQuotaLimits(context.env)).storageLimitBytes) {
      throw new ApiException('STORAGE_QUOTA_EXCEEDED', 'errors.storageQuotaExceeded', 413);
    }
    const extension = headers.data.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `site/services/${id.data}/${revision}/${variant.data}.${extension}`;
    await putVerifiedImage(context.env.MEDIA_BUCKET, context.req.raw, key, headers.data);
    const now = new Date().toISOString();
    const inserted = await context.env.DB.prepare(
      `INSERT INTO site_service_variants
       (service_id, revision, variant, storage_key, content_type, byte_size, width, height, checksum_sha256, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM site_services WHERE id = ? AND pending_image_revision = ?)
       ON CONFLICT(service_id, revision, variant) DO NOTHING`,
    ).bind(id.data, revision, variant.data, key, headers.data.contentType, headers.data.byteSize,
      headers.data.width, headers.data.height, headers.data.checksumSha256, now, id.data, revision).run();
    if (!inserted.meta.changes && !existing) {
      await context.env.MEDIA_BUCKET.delete(key);
      throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 409);
    }
    return context.json(ServiceImageUploadResponseSchema.parse({ variant: variant.data }));
  });

  app.post('/api/v1/admin/services/:id/image/:revision/publish', async (context) => {
    requireOwner(context);
    applyCachePolicy(context, 'admin');
    const id = ServiceIdSchema.safeParse(context.req.param('id'));
    const revision = Number(context.req.param('revision'));
    if (!id.success || !Number.isSafeInteger(revision)) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const row = await serviceRow(context.env.DB, id.data);
    if (!row || row.pending_image_revision !== revision) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 404);
    const variants = await context.env.DB.prepare('SELECT variant FROM site_service_variants WHERE service_id = ? AND revision = ?')
      .bind(id.data, revision).all<{ variant: string }>();
    const names = new Set(variants.results.map((item) => item.variant));
    if (!requiredVariants.every((name) => names.has(name))) throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
    const dimensions = await context.env.DB.prepare('SELECT variant, width, height, storage_key, byte_size, checksum_sha256 FROM site_service_variants WHERE service_id = ? AND revision = ?')
      .bind(id.data, revision).all<Pick<VariantRow, 'variant' | 'width' | 'height' | 'storage_key' | 'byte_size' | 'checksum_sha256'>>();
    const ordered = requiredVariants.map((name) => dimensions.results.find((item) => item.variant === name));
    if (ordered.some((item, index) => !item || (index > 0 && item.width < (ordered[index - 1]?.width ?? 0)))) {
      throw new ApiException('INVALID_VARIANT_MEDIA', 'errors.invalidVariantMedia', 422);
    }
    const objects = await Promise.all(ordered.map((item) => context.env.MEDIA_BUCKET.head(item!.storage_key)));
    if (objects.some((object, index) => !object || object.size !== ordered[index]?.byte_size ||
      object.customMetadata?.checksumSha256 !== ordered[index]?.checksum_sha256)) {
      throw new ApiException('VARIANTS_INCOMPLETE', 'errors.variantsIncomplete', 409);
    }
    const now = new Date().toISOString();
    await context.env.DB.batch([
      ...await oldImageCleanup(context.env.DB, id.data, row.image_revision, now),
      context.env.DB.prepare('UPDATE site_services SET image_revision = ?, pending_image_revision = NULL, updated_at = ? WHERE id = ? AND pending_image_revision = ?')
        .bind(revision, now, id.data, revision),
      ...(id.data === 'home-hero' ? [context.env.DB.prepare(`UPDATE site_settings SET home_hero_image_enabled = 1, updated_at = ?
        WHERE id = 1 AND EXISTS (SELECT 1 FROM site_services WHERE id = 'home-hero' AND image_revision = ?)`)
        .bind(now, revision)] : []),
    ]);
    if (id.data === 'home-hero') return context.json(ServiceImageRevisionSchema.parse({ revision }));
    const card = (await listServices(context.env.DB)).find((item) => item.id === id.data);
    if (!card) throw new ApiException('SERVICE_NOT_FOUND', 'errors.routeNotFound', 500);
    return context.json(ServiceCardSchema.parse(card));
  });
}
