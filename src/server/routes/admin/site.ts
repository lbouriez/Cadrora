import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { AdminSiteSettingsSchema, SiteSettingsSchema, UpdateSiteSettingsSchema } from '../../../shared/schemas';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import { quotaCeilings, siteQuotaSnapshot } from '../../services/quotas';
import type { AppEnv } from '../../types';

interface SiteSettingsRow {
  contact_email: string | null;
  default_language: 'fr' | 'en';
  enabled_languages: string;
  site_name: string;
  theme_mode: 'dark' | 'light' | 'both' | 'system';
  updated_at: string;
}

function requireAdmin(context: { get(name: 'auth'): AppEnv['Variables']['auth'] }): void {
  if (!context.get('auth').admin) throw new ApiException('ADMIN_AUTH_REQUIRED', 'errors.adminAuthRequired', 401);
}

function settingsFromRow(row: SiteSettingsRow) {
  return SiteSettingsSchema.parse({
    contactEmail: row.contact_email,
    defaultLanguage: row.default_language,
    enabledLanguages: JSON.parse(row.enabled_languages) as unknown,
    siteName: row.site_name,
    themeMode: row.theme_mode,
    updatedAt: row.updated_at,
  });
}

async function findSettings(database: D1Database) {
  return database.prepare(
    'SELECT site_name, default_language, enabled_languages, contact_email, theme_mode, updated_at FROM site_settings WHERE id = 1',
  ).first<SiteSettingsRow>();
}

async function adminSettings(context: { env: CloudflareBindings }, row: SiteSettingsRow) {
  const quota = await siteQuotaSnapshot(context.env);
  return AdminSiteSettingsSchema.parse({
    ...settingsFromRow(row),
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

  routes.patch('/site', async (context) => {
    requireAdmin(context);
    applyCachePolicy(context, 'admin');
    const input = UpdateSiteSettingsSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) throw new ApiException('INVALID_REQUEST', 'errors.invalidRequest', 400);
    const ceilings = quotaCeilings(context.env);
    if (
      input.data.quotas.faceLimit > ceilings.faceLimit
      || input.data.quotas.galleryLimit > ceilings.galleryLimit
      || input.data.quotas.storageLimitBytes > ceilings.storageLimitBytes
    ) throw new ApiException('QUOTA_ABOVE_DEPLOYMENT_LIMIT', 'errors.invalidRequest', 400);
    const updatedAt = new Date().toISOString();
    const result = await context.env.DB.prepare(
      `UPDATE site_settings
          SET default_language = ?1, enabled_languages = ?2, theme_mode = ?3,
              owner_gallery_limit = ?4, owner_storage_limit_bytes = ?5,
              owner_face_limit = ?6, updated_at = ?7
        WHERE id = 1`,
    ).bind(
      input.data.defaultLanguage,
      JSON.stringify(input.data.enabledLanguages),
      input.data.themeMode,
      input.data.quotas.galleryLimit,
      input.data.quotas.storageLimitBytes,
      input.data.quotas.faceLimit,
      updatedAt,
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
