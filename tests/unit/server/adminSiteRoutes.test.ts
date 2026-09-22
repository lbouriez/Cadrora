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

const quotaBindings = {
  MAX_EVENTS: '50',
  MAX_FACES_PER_EVENT: '10000',
  MAX_STORAGE_BYTES: '9900000000',
  MAX_TOTAL_FACES: '39000',
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

    await expect((await app.request('/api/v1/admin/site', undefined, { DB: database, ...quotaBindings })).json()).resolves.toMatchObject({
      quotaCeilings: { faceLimit: 39000, galleryLimit: 50, storageLimitBytes: 9900000000 },
      quotas: { faceLimit: 39000, galleryLimit: 50, storageLimitBytes: 9900000000 },
      themeMode: 'both',
    });
    const response = await app.request('/api/v1/admin/site', {
      body: JSON.stringify({
        defaultLanguage: 'en',
        enabledLanguages: ['en'],
        quotas: { faceLimit: 2000, galleryLimit: 5, storageLimitBytes: 1000000000 },
        themeMode: 'system',
      }),
      headers: { 'Content-Type': 'application/json', Origin: 'https://cadrora.test' },
      method: 'PATCH',
    }, { DB: database, ...quotaBindings });

    expect(response.status).toBe(200);
    expect(update.bind).toHaveBeenCalledWith(
      'en', '["en"]', 'system', 5, 1000000000, 2000, expect.any(String),
    );
  });

  it('refuses owner limits above the deployment guardrails', async () => {
    const prepare = vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(row),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    }));
    const database = {
      prepare,
    } as unknown as D1Database;

    const response = await appWith().request('/api/v1/admin/site', {
      body: JSON.stringify({
        defaultLanguage: 'fr',
        enabledLanguages: ['fr'],
        quotas: { faceLimit: 39001, galleryLimit: 5, storageLimitBytes: 1000000000 },
        themeMode: 'light',
      }),
      headers: { 'Content-Type': 'application/json', Origin: 'https://cadrora.test' },
      method: 'PATCH',
    }, { DB: database, ...quotaBindings });

    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
});
