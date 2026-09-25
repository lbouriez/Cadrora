import { describe, expect, it, vi } from 'vitest';

import { effectiveQuotaLimits, quotaCeilings, quotaUsage } from '../../../src/server/services/quotas';

const deploymentLimits = {
  MAX_FACES_PER_EVENT: '10000',
  MAX_STORAGE_BYTES: '9900000000',
  MAX_TOTAL_FACES: '39000',
};

describe('owner quota guardrails', () => {
  it('caps deployment settings at the relevant Cloudflare Free allowances', () => {
    expect(quotaCeilings({
      ...deploymentLimits,
      MAX_STORAGE_BYTES: '12000000000',
      MAX_TOTAL_FACES: '50000',
    })).toEqual({
      faceLimit: 39062,
      storageLimitBytes: 10000000000,
    });
  });

  it('uses the lower owner limits without allowing them to raise deployment ceilings', async () => {
    const first = vi.fn().mockResolvedValue({
      owner_face_limit: 1000,
      owner_storage_limit_bytes: 500000000,
    });
    const database = { prepare: vi.fn().mockReturnValue({ first }) } as unknown as D1Database;

    await expect(effectiveQuotaLimits({ DB: database, ...deploymentLimits })).resolves.toEqual({
      faceLimit: 1000,
      storageLimitBytes: 500000000,
    });
  });

  it('reports D1-backed usage for media variants and indexed faces', async () => {
    const prepare = vi.fn((query: string) => ({
      first: vi.fn().mockResolvedValue({
        value: query.includes('photo_variants') ? 750000 : 24,
      }),
    }));

    await expect(quotaUsage({ prepare } as unknown as D1Database)).resolves.toEqual({
      faces: 24,
      storageBytes: 750000,
    });
  });
});
