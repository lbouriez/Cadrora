import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerPortfolioRoutes } from '../../../src/server/routes/portfolio';
import type { AppEnv } from '../../../src/server/types';
import { ApiErrorSchema } from '../../../src/shared/schemas';

function portfolioApp() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId);
  app.onError(errorBoundary);
  app.use('*', async (context, next) => {
    context.set('auth', { admin: {
      access: 'manage', authMode: 'password', createdAt: '2026-09-27T00:00:00.000Z',
      expiresAt: '2026-09-28T00:00:00.000Z', id: 'owner', revokedAt: null, subject: 'owner',
    } });
    await next();
  });
  registerPortfolioRoutes(app);
  return app;
}

describe('portfolio publication and media', () => {
  it('does not publish a photo missing a required image variant', async () => {
    const publish = vi.fn();
    const database = { prepare: vi.fn((query: string) => ({
      bind: () => ({
        first: () => Promise.resolve(query.includes('FROM portfolio_photos WHERE id')
          ? { id: 'photo-1', service_id: 'wedding', alt_json: '{"fr":"Couple","en":"Couple"}', sort_order: 0, state: 'pending' }
          : null),
        all: () => Promise.resolve({ results: [
          { photo_id: 'photo-1', variant: 'preview', storage_key: 'site/portfolio/photo-1/preview.webp', width: 64, height: 64, byte_size: 100, checksum_sha256: 'a' },
          { photo_id: 'photo-1', variant: 'small', storage_key: 'site/portfolio/photo-1/small.webp', width: 640, height: 640, byte_size: 100, checksum_sha256: 'a' },
        ] }),
        run: publish,
      }),
    })) } as unknown as D1Database;
    const head = vi.fn();
    const bucket = { head } as unknown as R2Bucket;
    const response = await portfolioApp().request('/api/v1/admin/portfolio/photo-1/publish', { method: 'POST' }, {
      DB: database, MEDIA_BUCKET: bucket,
    });
    expect(response.status).toBe(409);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe('VARIANTS_INCOMPLETE');
    expect(head).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('serves media only after the D1 published-photo and enabled-service check', async () => {
    let visible = false;
    const database = { prepare: vi.fn((query: string) => ({
      bind: () => ({ first: () => {
        expect(query).toContain("p.state = 'published'");
        expect(query).toContain('s.enabled = 1');
        return Promise.resolve(visible ? { storage_key: 'site/portfolio/photo-1/small.webp', content_type: 'image/webp', byte_size: 4 } : null);
      } }),
    })) } as unknown as D1Database;
    const get = vi.fn().mockResolvedValue({ body: new Blob(['test']).stream(), size: 4, httpEtag: '"test"' });
    const bucket = { get } as unknown as R2Bucket;
    const app = portfolioApp();
    const hidden = await app.request('/portfolio-media/photo-1/small', undefined, { DB: database, MEDIA_BUCKET: bucket });
    expect(hidden.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
    visible = true;
    const published = await app.request('/portfolio-media/photo-1/small', undefined, { DB: database, MEDIA_BUCKET: bucket });
    expect(published.status).toBe(200);
    expect(published.headers.get('Content-Type')).toBe('image/webp');
    expect(await published.text()).toBe('test');
  });
});
