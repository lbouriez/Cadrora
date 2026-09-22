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
    expect(UpdateSiteSettingsSchema.safeParse({
      defaultLanguage: 'fr',
      enabledLanguages: ['en'],
      quotas: { faceLimit: 100, galleryLimit: 5, storageLimitBytes: 1000 },
      themeMode: 'system',
    }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse({
      defaultLanguage: 'fr',
      enabledLanguages: ['fr', 'fr'],
      quotas: { faceLimit: 100, galleryLimit: 5, storageLimitBytes: 1000 },
      themeMode: 'system',
    }).success).toBe(false);
    expect(UpdateSiteSettingsSchema.safeParse({
      defaultLanguage: 'fr',
      enabledLanguages: ['fr', 'en'],
      quotas: { faceLimit: 100, galleryLimit: 5, storageLimitBytes: 1000 },
      themeMode: 'system',
    }).success).toBe(true);
  });
});
