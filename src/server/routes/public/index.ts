import type { Hono } from 'hono';

import type { AppEnv } from '../../types';
import { createPublicEventRoutes } from './events';
import type { PublicRouteServices } from './events';
import { createPublicSiteRoutes } from './site';

export function registerPublicRoutes(app: Hono<AppEnv>, services: PublicRouteServices = {}): void {
  app.route('/api/v1', createPublicSiteRoutes());
  app.route('/api/v1', createPublicEventRoutes(services));
}

export type { PublicRouteServices };
