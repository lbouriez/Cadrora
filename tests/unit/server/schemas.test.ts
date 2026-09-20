import { describe, expect, it } from 'vitest';

import { EventCredentialsSchema, EventSchema, ModelManifestSchema } from '../../../src/shared/schemas';

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
});

