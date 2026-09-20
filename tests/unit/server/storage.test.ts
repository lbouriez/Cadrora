import { describe, expect, it, vi } from 'vitest';

import { R2StorageService } from '../../../src/server/services/storage';

describe('R2StorageService', () => {
  it('deletes keys in bounded R2 batches', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const bucket = { delete: remove } as unknown as R2Bucket;
    const service = new R2StorageService(bucket);
    const keys = Array.from({ length: 2_001 }, (_, index) => `key-${index}`);

    await service.deleteMany(keys);

    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls[0]?.[0]).toHaveLength(1_000);
    expect(remove.mock.calls[2]?.[0]).toHaveLength(1);
  });
});

