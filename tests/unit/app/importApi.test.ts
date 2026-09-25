import { afterEach, describe, expect, it, vi } from 'vitest';

import { FetchImportApi, type ImportRequestError } from '../../../src/browser/jobs/ImportApi';

describe('FetchImportApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not call native fetch with the API instance as its receiver', async () => {
    const receivers: unknown[] = [];
    const urls: string[] = [];
    vi.stubGlobal('fetch', function (this: unknown, input: RequestInfo | URL) {
      receivers.push(this);
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return Promise.resolve(new Response(JSON.stringify({
        code: 'IMPORT_NOT_FOUND', message: 'Not found', requestId: 'request-test',
      }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    });

    const api = new FetchImportApi();
    await expect(api.cancelImport('import-test')).rejects.toMatchObject({
      code: 'IMPORT_NOT_FOUND', status: 404,
    } satisfies Partial<ImportRequestError>);
    expect(receivers).not.toContain(api);
    expect(urls).toEqual(['/api/v1/admin/imports/import-test/cancel']);
  });

  it('retries an idempotent variant upload after an isolated 503', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'errors.serviceUnavailable', requestId: 'retry-1' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ variant: {
        photoId: 'photo-1', variant: 'download', storageKey: 'events/event-1/photos/photo-1/0/download.jpg',
        contentType: 'image/jpeg', byteSize: 4, width: 4, height: 4,
        checksumSha256: 'a'.repeat(64), createdAt: '2026-09-25T12:00:00.000Z',
      } }), { status: 200 }));
    const api = new FetchImportApi(fetcher);
    await api.uploadVariant('photo-1', {
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
      byteSize: 4, checksumSha256: 'a'.repeat(64), contentType: 'image/jpeg',
      height: 4, name: 'download', width: 4,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(fetcher.mock.calls[1]?.[1]?.body);
  });

  it('does not retry a permanent storage quota failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 'STORAGE_QUOTA_EXCEEDED', message: 'errors.storageQuotaExceeded', requestId: 'quota-1',
    }), { status: 413 }));
    const api = new FetchImportApi(fetcher);
    await expect(api.uploadVariant('photo-1', {
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
      byteSize: 4, checksumSha256: 'a'.repeat(64), contentType: 'image/jpeg',
      height: 4, name: 'download', width: 4,
    })).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED', status: 413 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts a hanging variant request and retries the same photo', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>()
        .mockImplementationOnce((_input, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out.', 'AbortError')), { once: true });
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ variant: {
          photoId: 'photo-1', variant: 'download', storageKey: 'events/event-1/photos/photo-1/0/download.jpg',
          contentType: 'image/jpeg', byteSize: 4, width: 4, height: 4,
          checksumSha256: 'a'.repeat(64), createdAt: '2026-09-25T12:00:00.000Z',
        } }), { status: 200 }));
      const api = new FetchImportApi(fetcher);
      const upload = api.uploadVariant('photo-1', {
        blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
        byteSize: 4, checksumSha256: 'a'.repeat(64), contentType: 'image/jpeg',
        height: 4, name: 'download', width: 4,
      });
      await vi.advanceTimersByTimeAsync(90_400);
      await upload;
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
