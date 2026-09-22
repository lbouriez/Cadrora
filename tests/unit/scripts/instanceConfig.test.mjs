import { describe, expect, it } from 'vitest';

import {
  assertManifestTarget,
  instanceResourceNames,
  instanceWranglerConfig,
  parseInstanceArguments,
  parseR2BucketNames,
} from '../../../scripts/instances/instanceConfig.mjs';

describe('isolated instance deployment configuration', () => {
  it('accepts an exact root domain or subdomain and rejects URL syntax', () => {
    expect(parseInstanceArguments([
      '--instance', 'alice', '--hostname', 'alice.cadrora.com', '--confirm',
    ])).toEqual({ hostname: 'alice.cadrora.com', instance: 'alice' });
    expect(parseInstanceArguments([
      '--instance', 'studio', '--hostname', 'photographer.example', '--confirm',
    ])).toEqual({ hostname: 'photographer.example', instance: 'studio' });
    expect(() => parseInstanceArguments([
      '--instance', 'alice', '--hostname', 'https://alice.cadrora.com', '--confirm',
    ])).toThrow('Hostname');
  });

  it('derives isolated resource names and an exact custom-domain route', () => {
    const names = instanceResourceNames('alice');
    const base = {
      d1_databases: [{ binding: 'DB', database_name: 'cadrora' }],
      env: { preview: {} },
      name: 'cadrora',
      r2_buckets: [{ binding: 'MEDIA_BUCKET' }, { binding: 'MODELS_BUCKET' }],
      vars: { DEMO_SHOWCASE_ENABLED: 'true' },
      vectorize: [{ binding: 'FACE_INDEX', index_name: 'cadrora-face-index' }],
    };
    const config = instanceWranglerConfig(base, names, 'database-uuid', 'alice.cadrora.com');

    expect(names).toEqual({
      database: 'cadrora-alice',
      faceIndex: 'cadrora-alice-face-index',
      mediaBucket: 'cadrora-alice-media',
      modelsBucket: 'cadrora-alice-models',
      worker: 'cadrora-alice',
    });
    expect(config).toMatchObject({
      d1_databases: [{ database_id: 'database-uuid', database_name: 'cadrora-alice' }],
      name: 'cadrora-alice',
      routes: [{ custom_domain: true, pattern: 'alice.cadrora.com' }],
      vars: { DEMO_SHOWCASE_ENABLED: 'false' },
    });
    expect(config).not.toHaveProperty('env');
    expect(base).toHaveProperty('env.preview');
  });

  it('reads Wrangler R2 list output without relying on table borders', () => {
    expect(parseR2BucketNames('name: cadrora-media\ncreation_date: now\n\nname: cadrora-alice-media\n'))
      .toEqual(new Set(['cadrora-media', 'cadrora-alice-media']));
  });

  it('prevents an instance name from being silently moved to another hostname', () => {
    expect(() => assertManifestTarget(
      { hostname: 'alice.cadrora.com', instance: 'alice' },
      { hostname: 'bob.cadrora.com', instance: 'alice' },
    )).toThrow('already recorded for alice.cadrora.com');
    expect(() => assertManifestTarget(
      { hostname: 'alice.cadrora.com', instance: 'alice' },
      { hostname: 'alice.cadrora.com', instance: 'alice' },
    )).not.toThrow();
  });
});
