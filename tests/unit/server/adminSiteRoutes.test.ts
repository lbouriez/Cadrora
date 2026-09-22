import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { createAdminSiteRoutes } from '../../../src/server/routes/admin/site';
import type { AppEnv } from '../../../src/server/types';

const row = {
  contact_email: null,
  default_language: 'fr' as const,
  enabled_languages: '["fr","en"]',
  site_name: 'Cadrora',
  theme_mode: 'both' as const,
  updated_at: '2026-09-21T00:00:00.000Z',
};

function appWith() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', async (context, next) => {
    context.set('auth', {
      admin: {
        access: 'manage',
        authMode: 'password',
        createdAt: row.updated_at,
        expiresAt: '2026-09-21T08:00:00.000Z',
        id: 'owner',
        revokedAt: null,
        subject: 'owner',
      },
    });
    await next();
  });
  app.route('/api/v1/admin', createAdminSiteRoutes());
  return app;
}

describe('admin site settings routes', () => {
  it('returns and persists the public theme mode for an owner', async () => {
    const select = { first: vi.fn().mockResolvedValue(row) };
    const update = { bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }) };
    const database = {
      prepare: vi.fn((query: string) => query.startsWith('UPDATE') ? update : select),
    } as unknown as D1Database;
    const app = appWith();

    await expect((await app.request('/api/v1/admin/site', undefined, { DB: database })).json()).resolves.toMatchObject({ themeMode: 'both' });
    const response = await app.request('/api/v1/admin/site', {
      body: JSON.stringify({ defaultLanguage: 'en', enabledLanguages: ['en'], themeMode: 'system' }),
      headers: { 'Content-Type': 'application/json', Origin: 'https://cadrora.test' },
      method: 'PATCH',
    }, { DB: database });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith('en', '["en"]', 'system', expect.any(String));
  });
});
