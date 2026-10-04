import { describe, expect, it } from 'vitest';
import { renderMarketing } from '../../../src/app/prerender/render';
import { MarketingSnapshotSchema } from '../../../src/shared/schemas/marketingSnapshot';

function snapshot(language: 'fr' | 'en') {
  return MarketingSnapshotSchema.parse({ version: 1, language, pathname: `/${language}/`, services: [], settings: {
    siteName: 'Studio', defaultLanguage: 'fr', enabledLanguages: ['fr', 'en'],
    contactEmail: null, contactPhone: null, contactAddress: null, serviceArea: null,
    map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
    enabledServices: ['wedding'], analyticsMeasurementId: null, themeMode: 'both',
    homeGalleries: { enabled: true, limit: 6 }, homeHeroImageRevision: 7,
    updatedAt: '2026-10-03T00:00:00.000Z',
  } });
}

describe('marketing rendering in a Worker without browser globals', () => {
  it('keeps concurrent languages isolated and emits only the resolved owner photo', async () => {
    const outputs = await Promise.all(['fr', 'en', 'fr', 'en'].map((language) => renderMarketing(snapshot(language as 'fr' | 'en'))));
    outputs.forEach((html, index) => {
      expect(html).toContain(index % 2 ? 'Your privacy, your choice.' : 'Votre vie privée, votre choix.');
      expect(html).toContain('/service-media/home-hero/7/small 640w');
      expect(html).not.toContain('/home-hero-image/');
      expect(html).toContain('session-home__stage--pending');
      expect(html).toContain('inert=""');
      expect(html).toContain('privacy-consent');
    });
  });

  it('renders the actual Sessions controls and public text', async () => {
    const data = snapshot('en');
    data.pathname = '/en/services/';
    const html = await renderMarketing(data);
    expect(html).toContain('session-home__stage--pending');
    expect(html).toContain('service-detail-grid');
    expect(html).toContain('public-nav');
    expect(html).toContain('privacy-consent');
  });
});
