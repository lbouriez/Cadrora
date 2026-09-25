import { describe, expect, it, vi } from 'vitest';

import { putDemoObject } from '../../../scripts/demo/seed.mjs';

describe('idempotent showcase R2 uploads', () => {
  it('retries a failed upload and keeps the same object arguments', async () => {
    const args = ['r2', 'object', 'put', 'bucket/demo/photo.webp', '--force'];
    const environment = { CADRORA_SEED_DEMO: 'true' };
    const put = vi.fn().mockImplementationOnce(() => { throw new Error('provider unavailable'); });
    const pause = vi.fn();

    await putDemoObject(args, environment, put, pause);

    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenNthCalledWith(2, args, environment);
    expect(pause).toHaveBeenCalledWith(1500);
  });

  it('fails after three attempts without silently skipping the object', async () => {
    const put = vi.fn(() => { throw new Error('still unavailable'); });
    const pause = vi.fn();

    await expect(putDemoObject(['r2', 'object', 'put', 'bucket/demo/photo.webp', '--force'], {}, put, pause))
      .rejects.toThrow('still unavailable');
    expect(put).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(2);
  });
});
