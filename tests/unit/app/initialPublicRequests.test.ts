import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryApiError, getPublicServices } from '../../../src/app/public/api';

const bootstrap = readFileSync(new URL('../../../public/public-requests.js', import.meta.url), 'utf8');
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('early public metadata', () => {
  it('waits for the owner response and aborts a stalled read only at the deadline', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetch);
    const settled = vi.fn();
    const result = getPublicServices().catch((error: unknown) => { settled(); return error; });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ code: 'PUBLIC_METADATA_TIMEOUT', status: 408 });
    const options = (fetch.mock.calls as unknown[][])[0]?.[1] as RequestInit;
    expect(options.signal?.aborted).toBe(true);
  });

  it('bounds stalled response bodies and early promises too', async () => {
    vi.useFakeTimers();
    for (const response of [new Promise<Response>(() => {}), Promise.resolve(new Response(new ReadableStream()))]) {
      vi.stubGlobal('window', { cadroraInitialPublicRequests: new Map([['/api/v1/services', response]]) });
      const result = getPublicServices().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await result).toMatchObject({ code: 'PUBLIC_METADATA_TIMEOUT' });
    }
  });

  it('buffers an early response so a late app start can still read it', async () => {
    vi.useFakeTimers();
    const window = { location: { pathname: '/services' }, cadroraInitialPublicRequests: new Map<string, Promise<Response>>() };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json([])));
    runInNewContext(bootstrap, { window, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
    const response = await window.cadroraInitialPublicRequests.get('/api/v1/services');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await response?.json()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a stalled bootstrap request and stores a failed response without an unhandled rejection', async () => {
    vi.useFakeTimers();
    const window = { location: { pathname: '/contact' }, cadroraInitialPublicRequests: new Map<string, Promise<Response>>() };
    const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    runInNewContext(bootstrap, { window, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await window.cadroraInitialPublicRequests.get('/api/v1/site'))?.ok).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts localized Home and Sessions metadata before the application without requesting photos', () => {
    for (const pathname of ['/fr', '/fr/', '/en/', '/en/services/', '/fr/services']) {
      const fetch = vi.fn().mockResolvedValue(new Response('[]'));
      runInNewContext(bootstrap, { window: { location: { pathname } }, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
      expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual(['/api/v1/site', '/api/v1/services']);
    }
    for (const pathname of ['/en/about/', '/fr/portfolio/mariages/']) {
      const fetch = vi.fn().mockResolvedValue(new Response('{}'));
      runInNewContext(bootstrap, { window: { location: { pathname } }, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
      expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual(['/api/v1/site']);
    }
  });
  it('requests only optional public metadata and stays absent on admin/private routes', () => {
    for (const pathname of ['/services', '/about', '/admin/login', '/e/private-gallery']) {
      const fetch = vi.fn().mockResolvedValue(new Response('[]'));
      runInNewContext(bootstrap, { window: { location: { pathname } }, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
      expect(fetch.mock.calls.map((call: unknown[]) => call[0])).toEqual(pathname === '/services'
        ? ['/api/v1/site', '/api/v1/services'] : pathname === '/about' ? ['/api/v1/site'] : []);
    }
  });

  it('does not start duplicate requests if the application has already started', () => {
    const fetch = vi.fn();
    runInNewContext(bootstrap, { window: { location: { pathname: '/' }, cadroraPublicRequestsConsumed: true }, fetch, Map, Response, AbortController, setTimeout, clearTimeout });
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
