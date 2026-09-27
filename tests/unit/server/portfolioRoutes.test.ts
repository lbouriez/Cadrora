import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerPortfolioRoutes } from '../../../src/server/routes/portfolio';
import type { AppEnv } from '../../../src/server/types';
import { ApiErrorSchema } from '../../../src/shared/schemas';
import { PortfolioCollectionDetailSchema, PortfolioCollectionsSchema } from '../../../src/shared/schemas/portfolio';

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
  it('serves a collection card and its photos through separate public routes', async () => {
    const collection = {
      id: 'collection-1', slug: 'mariages', category_id: 'wedding',
      copy_json: JSON.stringify({ fr: { title: 'Mariages', description: 'Une histoire.' },
        en: { title: 'Weddings', description: 'A story.' } }),
      sort_order: 0, published: 1, cover_photo_id: 'photo-1',
    };
    const photo = { id: 'photo-1', collection_id: 'collection-1',
      alt_json: '{"fr":"Un couple","en":"A couple"}', sort_order: 0, state: 'published' };
    const variant = { photo_id: 'photo-1', variant: 'small', storage_key: 'site/portfolio/photo-1/small.webp',
      content_type: 'image/webp', byte_size: 100, width: 640, height: 427, checksum_sha256: 'sha' };
    const resultsFor = (query: string) => Promise.resolve({ results: query.includes('FROM portfolio_collections') ? [collection]
      : query.includes('FROM portfolio_photos') ? [photo]
        : query.includes('FROM portfolio_variants') ? [variant] : [] });
    const queries: string[] = [];
    const database = { prepare: vi.fn((query: string) => {
      queries.push(query);
      return { all: () => resultsFor(query), bind: () => ({ all: () => resultsFor(query),
        first: () => Promise.resolve(query.includes('FROM portfolio_collections') ? collection : null) }) };
    }) } as unknown as D1Database;
    const app = portfolioApp();
    const cards = await app.request('/api/v1/portfolio', undefined, { DB: database });
    expect(cards.status).toBe(200);
    const listed = PortfolioCollectionsSchema.parse(await cards.json());
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ slug: 'mariages', photoCount: 1 });
    expect(listed[0]?.coverSources).toHaveLength(1);
    const detail = await app.request('/api/v1/portfolio/mariages', undefined, { DB: database });
    expect(detail.status).toBe(200);
    expect(PortfolioCollectionDetailSchema.parse(await detail.json()).photos).toHaveLength(1);
    expect(queries.some((query) => query.includes('c.published = 1'))).toBe(true);
    expect(queries.some((query) => query.includes('WHERE slug = ? AND published = 1'))).toBe(true);
    expect(queries.some((query) => query.includes('WHERE collection_id = ? AND'))).toBe(true);
    expect(queries.some((query) => query.includes('FROM portfolio_variants WHERE photo_id IN'))).toBe(true);
    expect(queries.some((query) => query.includes('site_services'))).toBe(false);
  });

  it('does not publish a photo missing a required image variant', async () => {
    const publish = vi.fn();
    const database = { prepare: vi.fn((query: string) => ({
      bind: () => ({
        first: () => Promise.resolve(query.includes('FROM portfolio_photos WHERE id')
          ? { id: 'photo-1', alt_json: '{"fr":"Couple","en":"Couple"}', sort_order: 0, state: 'pending' }
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

  it('reloads an edited item by its id and reads only its variants', async () => {
    const photo = { id: 'photo-1', collection_id: 'collection-1',
      alt_json: '{"fr":"Un couple","en":"A couple"}', sort_order: 2, state: 'published' };
    const queries: string[] = [];
    const database = { prepare: vi.fn((query: string) => {
      queries.push(query);
      return { bind: (...values: unknown[]) => ({
        first: () => Promise.resolve(query.includes('FROM portfolio_photos WHERE id = ?') && values[0] === 'photo-1' ? photo : null),
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ success: true }),
      }) };
    }) } as unknown as D1Database;
    const response = await portfolioApp().request('/api/v1/admin/portfolio/photo-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt: { fr: 'Un couple', en: 'A couple' }, sortOrder: 2 }),
    }, { DB: database });
    expect(response.status).toBe(200);
    expect(queries.some((query) => query.includes('FROM portfolio_photos WHERE id = ?'))).toBe(true);
    expect(queries.some((query) => query.includes('FROM portfolio_variants WHERE photo_id IN (?)'))).toBe(true);
    expect(queries.some((query) => query.includes('JOIN portfolio_collections'))).toBe(false);
  });

  it('serves media only after the D1 published-photo and collection checks', async () => {
    let visible = false;
    const database = { prepare: vi.fn((query: string) => ({
      bind: () => ({ first: () => {
        expect(query).toContain("p.state = 'published'");
        expect(query).toContain('c.published = 1');
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
