import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryApiError, getPublicServices } from '../../../src/app/public/api';

const bootstrap = readFileSync(new URL('../../../public/public-requests.js', import.meta.url), 'utf8');
afterEach(() => vi.unstubAllGlobals());

describe('early public metadata', () => {
  it('requests only optional public metadata and stays absent on admin/private routes', () => {
    for (const pathname of ['/services', '/about', '/admin/login', '/e/private-gallery']) {
      const fetch = vi.fn().mockResolvedValue(new Response('[]'));
      runInNewContext(bootstrap, { window: { location: { pathname } }, fetch, Map, Response });
      expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual(pathname === '/services'
        ? ['/api/v1/site', '/api/v1/services'] : pathname === '/about' ? ['/api/v1/site'] : []);
    }
  });

  it('does not start duplicate requests if the application has already started', () => {
    const fetch = vi.fn();
    runInNewContext(bootstrap, { window: { location: { pathname: '/' }, cadroraPublicRequestsConsumed: true }, fetch, Map, Response });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('consumes the early response once and fetches fresh metadata on a later refresh', async () => {
    const requests = new Map([['/api/v1/services', Promise.resolve(new Response('[]'))]]);
    vi.stubGlobal('window', { cadroraInitialPublicRequests: requests });
    const fetch = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', fetch);
    expect(await getPublicServices()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(requests.size).toBe(0);
    expect(await getPublicServices()).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects malformed and failed early responses through the existing API boundary', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { cadroraInitialPublicRequests: new Map([
      ['/api/v1/services', Promise.resolve(new Response('{"untrusted":true}'))],
    ]) });
    await expect(getPublicServices()).rejects.toThrow();
    vi.stubGlobal('window', { cadroraInitialPublicRequests: new Map([
      ['/api/v1/services', Promise.resolve(new Response('{}', { status: 503 }))],
    ]) });
    await expect(getPublicServices()).rejects.toBeInstanceOf(GalleryApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
