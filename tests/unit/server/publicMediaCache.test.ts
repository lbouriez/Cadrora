import { describe, expect, it, vi } from 'vitest';

import { purgePublicMediaCache, readPublicMediaCache } from '../../../src/server/services/publicMediaCache';

const props = {
  contentType: 'image/jpeg',
  eventId: '11111111-1111-4111-8111-111111111111',
  storageKey: 'events/11111111-1111-4111-8111-111111111111/photos/22222222-2222-4222-8222-222222222222/1/thumb.jpg',
};

describe('public media cache entrypoint bridge', () => {
  it('passes D1-derived props on the entrypoint stub and strips browser query parameters', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('photo'));
    const entrypoint = vi.fn().mockReturnValue({ fetch });
    const context = { exports: { PublicMediaCache: entrypoint } };
    const response = await readPublicMediaCache(context, 'https://example.com/media/gallery/photo/1/thumb?random=1', props);

    expect(response?.status).toBe(200);
    expect(entrypoint).toHaveBeenCalledWith({ props });
    const request = fetch.mock.calls[0]?.[0] as Request | undefined;
    expect(request?.url).toBe('https://example.com/media/gallery/photo/1/thumb');
    expect(request?.headers.has('Cookie')).toBe(false);
  });

  it('calls the named entrypoint purge method and fails closed when it is absent', async () => {
    const purgeGallery = vi.fn().mockResolvedValue(undefined);
    await purgePublicMediaCache({ exports: { PublicMediaCache: { purgeGallery } } }, props.eventId);
    expect(purgeGallery).toHaveBeenCalledWith(props.eventId);
    await expect(purgePublicMediaCache({}, props.eventId)).rejects.toThrow('PUBLIC_MEDIA_CACHE_PURGE_UNAVAILABLE');
  });
});
