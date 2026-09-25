import { describe, expect, it } from 'vitest';

import {
  CreateEventRequestSchema,
  EventCredentialsSchema,
  EventSchema,
  ModelManifestSchema,
  UpdateSiteSettingsSchema,
} from '../../../src/shared/schemas';

describe('shared schemas', () => {
  it('keeps event credentials separate from public events', () => {
    expect('passwordHash' in EventSchema.shape).toBe(false);
    expect('passwordHash' in EventCredentialsSchema.shape).toBe(true);
  });

  it('requires immutable HTTPS model URLs', () => {
    const result = ModelManifestSchema.safeParse({
      id: 'sface',
      version: '1.0.0',
      license: 'Apache-2.0',
      sha256: 'a'.repeat(64),
      byteSize: 1,
      dimensions: 128,
      preprocessing: 'documented',
      metric: 'cosine',
      immutableUrl: 'http://example.com/model.onnx',
    });
    expect(result.success).toBe(false);
  });

  it('only enables nearby moments when face search is enabled', () => {
    const event = {
      title: 'A gallery',
      startsAt: '2030-01-01T00:00:00.000Z',
      timezone: 'UTC',
      faceSearchEnabled: false,
      nearbySearchEnabled: true,
    };

    expect(CreateEventRequestSchema.safeParse(event).success).toBe(false);
    expect(CreateEventRequestSchema.safeParse({ ...event, faceSearchEnabled: true }).success).toBe(true);
  });

  it('requires at least one unique language and keeps the default enabled', () => {
    const settings = {
      analyticsMeasurementId: null,
      contactAddress: null,
      contactEmail: null,
      contactPhone: null,
      defaultLanguage: 'fr',
      enabledLanguages: ['fr', 'en'],
      enabledServices: ['wedding'],
      map: { centerLatitude: null, centerLongitude: null, radiusKm: null },
      quotas: { faceLimit: 100, storageLimitBytes: 1000 },
      serviceArea: null,
      siteName: 'Cadrora',
      themeMode: 'system',
    };
    expect(UpdateSiteSettingsSchema.safeParse({ ...settings, enabledLanguages: ['en'] }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse({ ...settings, enabledLanguages: ['fr', 'fr'] }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse(settings).success).toBe(true);
    expect(UpdateSiteSettingsSchema.safeParse({ ...settings, analyticsMeasurementId: 'bad-id' }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse({ ...settings, enabledServices: [] }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse({ ...settings, map: { centerLatitude: 45.5, centerLongitude: null, radiusKm: 50 } }).success).toBe(false);
  });
});
