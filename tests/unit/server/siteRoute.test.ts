import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { cacheHeaders } from '../../../src/server/middleware/cacheHeaders';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerPublicRoutes } from '../../../src/server/routes/public';
import type { AppEnv } from '../../../src/server/types';

describe('public site settings route', () => {
  it('returns validated public settings without becoming a website dependency', async () => {
    const statement = {
      first: vi.fn().mockResolvedValue({
        contact_email: null,
        default_language: 'fr',
        enabled_languages: '["fr","en"]',
        site_name: 'Cadrora',
        theme_mode: 'both',
        updated_at: '2026-09-20T00:00:00.000Z',
      }),
    };
    const database = { prepare: vi.fn().mockReturnValue(statement) } as unknown as D1Database;
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.use('*', cacheHeaders);
    registerPublicRoutes(app);

    const response = await app.request('/api/v1/site', undefined, { DB: database });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    await expect(response.json()).resolves.toEqual({
      contactEmail: null,
      defaultLanguage: 'fr',
      enabledLanguages: ['fr', 'en'],
      siteName: 'Cadrora',
      themeMode: 'both',
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
  });
});
