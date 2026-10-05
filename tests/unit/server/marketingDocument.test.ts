import { describe, expect, it, vi } from 'vitest';
import { marketingDocument, readMarketingSnapshot, serializeMarketingSnapshot } from '../../../src/server/http/marketingDocument';

const row = {
  site_name: 'Cadrora', default_language: 'fr', enabled_languages: '["fr","en"]',
  enabled_services: '["wedding"]', theme_mode: 'both', updated_at: '2026-10-03T00:00:00.000Z',
  contact_email: null, contact_phone: null, contact_address: null, service_area: null,
  analytics_measurement_id: null, map_center_latitude: null, map_center_longitude: null, map_radius_km: null,
  home_galleries_enabled: 1, home_galleries_limit: 6, home_hero_image_revision: 9,
};
function database() {
  return { prepare: vi.fn((sql: string) => ({ sql })), batch: vi.fn().mockResolvedValue([
    { success: true, results: [row] }, { success: true, results: [] }, { success: true, results: [] },
  ]) };
}

describe('uncached preview marketing documents', () => {
  it('reads settings and variants in one transaction, anew on every request', async () => {
    const db = database();
    const first = await readMarketingSnapshot(db as unknown as D1Database, '/fr/');
    db.batch.mockResolvedValueOnce([
      { success: true, results: [{ ...row, site_name: 'New name', home_hero_image_revision: 10 }] },
      { success: true, results: [] }, { success: true, results: [] },
    ]);
    const second = await readMarketingSnapshot(db as unknown as D1Database, '/en/');
    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(first.settings.homeHeroImageRevision).toBe(9);
    expect(second.settings.homeHeroImageRevision).toBe(10);
    expect(second.settings.siteName).toBe('New name');
    expect(second.language).toBe('en');
  });

  it('escapes script boundaries without changing the hydrated data', async () => {
    const data = await readMarketingSnapshot(database() as unknown as D1Database, '/fr/');
    data.settings.siteName = '</script><script>alert(1)</script>&';
    const json = serializeMarketingSnapshot(data);
    expect(json).not.toMatch(/[<>&]/u);
    expect(JSON.parse(json)).toEqual(data);
  });

  it('does not render private routes or POST requests', async () => {
    const db = database();
    const bindings = { DB: db } as unknown as CloudflareBindings;
    for (const path of ['/admin', '/e/private', '/api/v1/site', '/fr/portfolio/']) {
      expect(await marketingDocument(new Request(`https://preview.test${path}`), bindings)).toBeNull();
    }
    expect(await marketingDocument(new Request('https://preview.test/fr/', { method: 'POST' }), bindings)).toBeNull();
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('defers database failures and disabled Sessions to the existing fallback/status handler', async () => {
    const db = database();
    db.batch.mockRejectedValueOnce(new Error('Database unavailable'));
    const assetFetch = vi.fn();
    const bindings = { DB: db, ASSETS: { fetch: assetFetch } } as unknown as CloudflareBindings;
    expect(await marketingDocument(new Request('https://preview.test/fr/'), bindings)).toBeNull();
    db.batch.mockResolvedValueOnce([
      { success: true, results: [{ ...row, sessions_page_enabled: 0 }] },
      { success: true, results: [] }, { success: true, results: [] },
    ]);
    expect(await marketingDocument(new Request('https://preview.test/fr/services/'), bindings)).toBeNull();
    expect(assetFetch).not.toHaveBeenCalled();
  });
});
