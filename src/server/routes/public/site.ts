import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { SiteSettingsSchema } from '../../../shared/schemas';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import type { AppEnv } from '../../types';

interface SiteSettingsRow {
  contact_email: string | null;
  default_language: 'fr' | 'en';
  site_name: string;
  updated_at: string;
}

/** Public runtime settings. The static portfolio never depends on this route. */
export function createPublicSiteRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/site', async (context) => {
    const row = await context.env.DB.prepare(
      'SELECT site_name, default_language, contact_email, updated_at FROM site_settings WHERE id = 1',
    ).first<SiteSettingsRow>();
    if (!row) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);

    applyCachePolicy(context, 'event-public');
    return context.json(SiteSettingsSchema.parse({
      contactEmail: row.contact_email,
      defaultLanguage: row.default_language,
      siteName: row.site_name,
      updatedAt: row.updated_at,
    }));
  });

  return routes;
}
