import { afterEach, describe, expect, it, vi } from 'vitest';

import { GalleryApiError, getPublicEvent } from '../../../src/app/public/api';

describe('gallery API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves a safe API error code for access recovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'EVENT_GRANT_INVALID',
      message: 'errors.eventAccessRequired',
      requestId: 'request-1',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    })));

    const error = await getPublicEvent('private-wedding').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(GalleryApiError);
    expect(error).toMatchObject({ code: 'EVENT_GRANT_INVALID', status: 401 });
  });
});
