import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as BrowserImages from '../../../src/browser/images';

const encoder = vi.hoisted(() => ({ encodeService: vi.fn(), dispose: vi.fn() }));
vi.mock('../../../src/browser/images', async (importOriginal) => ({
  ...await importOriginal<typeof BrowserImages>(),
  createImageEncoder: () => encoder,
}));

import { uploadMarketingPhoto } from '../../../src/app/admin/uploadMarketingPhoto';

const photoId = '00000000-0000-4000-8000-000000000001';
const collectionId = '00000000-0000-4000-8000-000000000002';
const names = ['preview', 'small', 'medium', 'large'] as const;

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('shared marketing photo upload', () => {
  it('uses one four-variant upload flow with destination-specific revision and publish routes', async () => {
    encoder.encodeService.mockResolvedValue({ width: 3000, height: 2000, variants: names.map((name) => ({
      name, blob: new Blob(['image']), byteSize: 5, checksumSha256: 'a'.repeat(64),
      contentType: 'image/jpeg', width: 320, height: 240,
    })) });
    const requests: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith('/image-revision')) return Promise.resolve(Response.json({ revision: 2 }));
      if (url.endsWith('/publish') && url.includes('/portfolio/')) return Promise.resolve(Response.json({
        id: photoId, collectionId, alt: { fr: 'Photo', en: 'Photo' },
        sortOrder: 0, state: 'published', imageSources: [],
      }));
      if (url.endsWith('/publish') && (url.includes('/home-hero/') || url.includes('/about-hero/'))) return Promise.resolve(Response.json({ revision: 2 }));
      if (url.endsWith('/publish')) return Promise.resolve(Response.json({
        id: 'wedding', isBuiltin: true, sortOrder: 0, enabled: true, showOnHome: true,
        copy: null, imageRevision: 2, imageSources: [],
      }));
      return Promise.resolve(Response.json({ variant: names.find((name) => url.endsWith(`/${name}`)) }));
    }));
    const file = new File(['image'], 'source.jpg', { type: 'image/jpeg' });
    await uploadMarketingPhoto(file, { kind: 'service', id: 'wedding' });
    await uploadMarketingPhoto(file, { kind: 'home-hero' }, 'lighter');
    await uploadMarketingPhoto(file, { kind: 'about-hero' }, 'lighter');
    await uploadMarketingPhoto(file, { kind: 'portfolio', id: photoId }, 'lighter');

    expect(encoder.encodeService).toHaveBeenNthCalledWith(1, file, 'balanced');
    for (const call of [2, 3, 4]) expect(encoder.encodeService).toHaveBeenNthCalledWith(call, file, 'lighter');
    expect(encoder.dispose).toHaveBeenCalledTimes(4);
    expect(requests.filter(({ init }) => init.method === 'PUT')).toHaveLength(16);
    expect(requests.map(({ url }) => url)).toContain('/api/v1/admin/services/wedding/image/2/large');
    expect(requests.map(({ url }) => url)).toContain('/api/v1/admin/services/home-hero/image/2/publish');
    expect(requests.map(({ url }) => url)).toContain('/api/v1/admin/services/about-hero/image/2/publish');
    expect(requests.map(({ url }) => url)).toContain(`/api/v1/admin/portfolio/${photoId}/publish`);
    expect(requests.find(({ init }) => init.method === 'PUT')?.init.headers).toMatchObject({
      'X-Cadrora-Byte-Size': '5', 'X-Cadrora-Checksum-Sha256': 'a'.repeat(64),
    });
  });

  it('requires a full-width source for the Home photo before creating an upload revision', async () => {
    encoder.encodeService.mockResolvedValue({ width: 2000, height: 1500, variants: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadMarketingPhoto(new File(['image'], 'source.jpg'), { kind: 'home-hero' }))
      .rejects.toThrow('HOME_HERO_IMAGE_TOO_SMALL');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(encoder.dispose).toHaveBeenCalledOnce();
  });
});
