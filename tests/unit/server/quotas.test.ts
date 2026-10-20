import { describe, expect, it, vi } from 'vitest';

import { effectiveQuotaLimits, quotaCeilings, quotaUsage, storedMediaBytes } from '../../../src/server/services/quotas';

const deploymentLimits = {
  MAX_FACES_PER_EVENT: '10000',
  MAX_STORAGE_BYTES: '9900000000',
  MAX_TOTAL_FACES: '39000',
};

describe('owner quota guardrails', () => {
  it.each(['', '0', '-1', '1.5', 'NaN', '9007199254740992'])('rejects an invalid deployment ceiling: %s', (value) => {
    expect(() => quotaCeilings({ ...deploymentLimits, MAX_STORAGE_BYTES: value })).toThrow();
    expect(() => quotaCeilings({ ...deploymentLimits, MAX_TOTAL_FACES: value })).toThrow();
  });

  it('keeps deployment ceilings authoritative even when stored owner limits are higher', async () => {
    const database = { prepare: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({
      owner_face_limit: 50000, owner_storage_limit_bytes: 12000000000,
    }) }) } as unknown as D1Database;
    await expect(effectiveQuotaLimits({ DB: database, ...deploymentLimits })).resolves.toEqual({
      faceLimit: 39000, storageLimitBytes: 9900000000,
    });
  });

  it('honors explicitly configured capacity above the default free-tier guardrails', () => {
    expect(quotaCeilings({
      ...deploymentLimits,
      MAX_STORAGE_BYTES: '12000000000',
      MAX_TOTAL_FACES: '50000',
    })).toEqual({
      faceLimit: 50000,
      storageLimitBytes: 12000000000,
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
        value: query.includes('usage_counters') ? 750000 : 24,
      }),
    }));

    await expect(quotaUsage({ prepare } as unknown as D1Database)).resolves.toEqual({
      faces: 24,
      storageBytes: 750000,
    });
  });

  it('fails closed if the migrated storage counter is unavailable', async () => {
    const database = { prepare: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }) } as unknown as D1Database;
    await expect(storedMediaBytes(database)).rejects.toMatchObject({ code: 'CONFIGURATION_INVALID', status: 503 });
  });
});
