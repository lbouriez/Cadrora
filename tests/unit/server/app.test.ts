import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '../../../src/shared/schemas';
import { app } from '../../../src/server/app';

describe('worker app', () => {
  it('serves known client documents after the admin guard and preserves unknown status', async () => {
    const assetFetch = vi.fn((request: Request) => Promise.resolve(new Response('<!doctype html><title>Shell</title>', {
      status: new URL(request.url).pathname === '/' ? 200 : 404,
      headers: { 'Content-Type': 'text/html' },
    })));
    const bindings = { ADMIN_AUTH_MODE: 'password', ASSETS: { fetch: assetFetch } } as unknown as CloudflareBindings;
    const denied = await app.request('/admin/settings', undefined, bindings);
    expect(denied.status).toBe(302);
    expect(assetFetch).not.toHaveBeenCalled();
    const login = await app.request('/admin/login', undefined, bindings);
    expect(login.status).toBe(200);
    expect(login.headers.get('Cache-Control')).toBe('no-store');
    const gallery = await app.request('/e/wedding', undefined, bindings);
    expect(gallery.status).toBe(200);
    expect(gallery.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const missing = await app.request('/fr/not-a-route', undefined, bindings);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns a JSON API 404 with a request id and no HTML fallback', async () => {
    const response = await app.request('/api/v1/not-a-route');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.code).toBe('ROUTE_NOT_FOUND');
    expect(body.requestId).not.toBe('');
  });

  it('does not retain the retired events API alias', async () => {
    const response = await app.request('/api/v1/events');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(body.code).toBe('ROUTE_NOT_FOUND');
  });
});
