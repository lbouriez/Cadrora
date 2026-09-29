import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { AdminSiteSettingsSchema, HomeHeroCopySchema, UpdateAboutSchema, UpdateSiteSettingsSchema } from '../../../shared/schemas';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { quotaCeilings, siteQuotaSnapshot } from '../../services/quotas';
import type { AppEnv } from '../../types';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from '../siteSettings';
import { oldImageCleanup } from '../services';
import type { SiteSettingsRow } from '../siteSettings';

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

async function findSettings(database: D1Database) {
  return database.prepare(SITE_SETTINGS_SELECT).first<SiteSettingsRow>();
}

async function adminSettings(context: { env: CloudflareBindings }, row: SiteSettingsRow) {
  const quota = await siteQuotaSnapshot(context.env);
  return AdminSiteSettingsSchema.parse({
    ...siteSettingsFromRow(row),
    quotaCeilings: quota.ceilings,
    quotas: quota.limits,
    usage: quota.usage,
  });
}

/** Owner-only settings which affect the public shell without making it a dependency. */
export function createAdminSiteRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/site', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  routes.patch('/site/home-hero', async (context) => {
    if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
    applyCachePolicy(context, 'admin');
    const input = HomeHeroCopySchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    await context.env.DB.prepare('UPDATE site_settings SET home_hero_copy = ?, updated_at = ? WHERE id = 1')
      .bind(JSON.stringify(input.data), new Date().toISOString()).run();
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  routes.post('/site/home-hero/reset', async (context) => {
    if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
    applyCachePolicy(context, 'admin');
    const row = await context.env.DB.prepare('SELECT image_revision, pending_image_revision FROM site_services WHERE id = ?')
      .bind('home-hero').first<{ image_revision: number; pending_image_revision: number | null }>();
    if (!row) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    const now = new Date().toISOString();
    await context.env.DB.batch([
      ...await oldImageCleanup(context.env.DB, 'home-hero', row.image_revision, now),
      ...await oldImageCleanup(context.env.DB, 'home-hero', row.pending_image_revision ?? 0, now),
      context.env.DB.prepare('UPDATE site_services SET image_revision = ?, pending_image_revision = NULL, updated_at = ? WHERE id = ?')
        .bind(Math.max(row.image_revision, row.pending_image_revision ?? 0), now, 'home-hero'),
      context.env.DB.prepare('UPDATE site_settings SET home_hero_copy = NULL, home_hero_image_enabled = 0, updated_at = ? WHERE id = 1').bind(now),
    ]);
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  routes.patch('/site/about', async (context) => {
    if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
    applyCachePolicy(context, 'admin');
    const input = UpdateAboutSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    await context.env.DB.prepare('UPDATE site_settings SET about_enabled = ?, about_copy = ?, updated_at = ? WHERE id = 1')
      .bind(Number(input.data.enabled), JSON.stringify(input.data.copy), new Date().toISOString()).run();
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  routes.post('/site/about/photo/reset', async (context) => {
    if (context.get('auth').admin?.access !== 'manage') throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 403);
    applyCachePolicy(context, 'admin');
    const row = await context.env.DB.prepare('SELECT image_revision, pending_image_revision FROM site_services WHERE id = ?')
      .bind('about-hero').first<{ image_revision: number; pending_image_revision: number | null }>();
    if (!row) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    const now = new Date().toISOString();
    await context.env.DB.batch([
      ...await oldImageCleanup(context.env.DB, 'about-hero', row.image_revision, now),
      ...await oldImageCleanup(context.env.DB, 'about-hero', row.pending_image_revision ?? 0, now),
      context.env.DB.prepare('UPDATE site_services SET image_revision = ?, pending_image_revision = NULL, updated_at = ? WHERE id = ?')
        .bind(Math.max(row.image_revision, row.pending_image_revision ?? 0), now, 'about-hero'),
      context.env.DB.prepare('UPDATE site_settings SET about_image_enabled = 0, updated_at = ? WHERE id = 1').bind(now),
    ]);
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  routes.patch('/site', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = UpdateSiteSettingsSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const ceilings = quotaCeilings(context.env);
    if (
      input.data.quotas.faceLimit > ceilings.faceLimit
      || input.data.quotas.storageLimitBytes > ceilings.storageLimitBytes
    ) throw new ApiException('QUOTA_ABOVE_DEPLOYMENT_LIMIT', 'errors.invalidRequest', 400);
    const currentDirectory = input.data.galleryDirectoryEnabled === undefined
      ? await context.env.DB.prepare('SELECT gallery_directory_enabled FROM site_settings WHERE id = 1')
        .first<{ gallery_directory_enabled: number }>() : null;
    const galleryDirectoryEnabled = input.data.galleryDirectoryEnabled === undefined
      ? currentDirectory?.gallery_directory_enabled !== 0 : input.data.galleryDirectoryEnabled;
    if (!galleryDirectoryEnabled) {
      const publicGallery = await context.env.DB.prepare(
        "SELECT id FROM events WHERE access = 'public' AND visibility = 'published' AND offline_at IS NULL AND deleting_at IS NULL LIMIT 1",
      ).first<{ id: string }>();
      if (publicGallery) throw new ApiException('PUBLIC_GALLERIES_REMAIN', 'errors.publicGalleriesRemain', 409);
    }
    const updatedAt = new Date().toISOString();
    const result = await context.env.DB.prepare(
      `UPDATE site_settings
          SET default_language = ?1, enabled_languages = ?2, theme_mode = ?3,
              owner_storage_limit_bytes = ?4, owner_face_limit = ?5,
              analytics_measurement_id = ?6, contact_email = ?7,
              contact_phone = ?8, contact_address = ?9, service_area = ?10,
              map_center_latitude = ?11, map_center_longitude = ?12,
              map_radius_km = ?13, enabled_services = ?14,
              site_name = ?15, home_galleries_enabled = ?16,
              home_galleries_limit = ?17,
              home_services_limit = ?18,
              site_copy = COALESCE(?19, site_copy), updated_at = ?20,
              gallery_directory_enabled = ?21,
              construction_notice_enabled = COALESCE(?22, construction_notice_enabled)
        WHERE id = 1`,
    ).bind(
      input.data.defaultLanguage,
      JSON.stringify(input.data.enabledLanguages),
      input.data.themeMode,
      input.data.quotas.storageLimitBytes,
      input.data.quotas.faceLimit,
      input.data.analyticsMeasurementId,
      input.data.contactEmail,
      input.data.contactPhone,
      input.data.contactAddress,
      input.data.serviceArea,
      input.data.map.centerLatitude,
      input.data.map.centerLongitude,
      input.data.map.radiusKm,
      JSON.stringify(input.data.enabledServices),
      input.data.siteName,
      Number(input.data.homeGalleries.enabled),
      input.data.homeGalleries.limit,
      input.data.homeServicesLimit,
      input.data.siteCopy === undefined ? null : JSON.stringify(input.data.siteCopy),
      updatedAt,
      Number(galleryDirectoryEnabled),
      input.data.constructionNoticeEnabled === undefined ? null : Number(input.data.constructionNoticeEnabled),
    ).run();
    if (!result.meta.changes) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    const settings = await findSettings(context.env.DB);
    if (!settings) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
    return context.json(await adminSettings(context, settings));
  });

  return routes;
}

export function registerAdminSiteRoutes(app: Hono<AppEnv>): void {
  app.route('/api/v1/admin', createAdminSiteRoutes());
}
