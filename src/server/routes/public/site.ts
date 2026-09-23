import { Hono } from 'hono';

import { ApiException } from '../../../shared/errors/ApiError';
import { applyCachePolicy } from '../../middleware/cacheHeaders';
import type { AppEnv } from '../../types';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from '../siteSettings';
import type { SiteSettingsRow } from '../siteSettings';

/** Public runtime settings. The static portfolio never depends on this route. */
export function createPublicSiteRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/site', async (context) => {
    const row = await context.env.DB.prepare(SITE_SETTINGS_SELECT).first<SiteSettingsRow>();
    if (!row) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);

    applyCachePolicy(context, 'event-public');
    return context.json(siteSettingsFromRow(row));
  });

  return routes;
}
