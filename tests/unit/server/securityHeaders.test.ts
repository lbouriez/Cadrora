import { readFileSync } from 'node:fs';

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { securityHeaders } from '../../../src/server/middleware/securityHeaders';
import type { AppEnv } from '../../../src/server/types';

describe('securityHeaders middleware', () => {
  it('adds baseline browser protections', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', securityHeaders);
    app.get('/test', (context) => context.text('ok'));

    const response = await app.request('https://cadrora.example/test');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).toContain('https://challenges.cloudflare.com');
    expect(response.headers.get('Content-Security-Policy')).toContain("img-src 'self' blob: data: https://www.googletagmanager.com https://*.google-analytics.com");
    expect(response.headers.get('Content-Security-Policy')).toContain('connect-src \'self\' https://challenges.cloudflare.com https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com');
    expect(response.headers.get('Content-Security-Policy')).toContain('https://photon.komoot.io');
    expect(response.headers.get('Content-Security-Policy')).toContain('frame-src https://challenges.cloudflare.com https://www.google.com https://www.openstreetmap.org');
  });

  it('allows the click-to-load map in the static asset policy too', () => {
    const staticHeaders = readFileSync('public/_headers', 'utf8');
    expect(staticHeaders).toContain('frame-src https://challenges.cloudflare.com https://www.google.com https://www.openstreetmap.org');
    expect(staticHeaders).toContain("img-src 'self' blob: data: https://www.googletagmanager.com https://*.google-analytics.com");
    expect(staticHeaders).toContain("connect-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com");
    expect(staticHeaders).toContain('https://photon.komoot.io');
  });

  it('lets Vite inject its local React refresh preamble without weakening deployed hosts', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', securityHeaders);
    app.get('/test', (context) => context.text('ok'));

    const response = await app.request('http://127.0.0.1/test');
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
