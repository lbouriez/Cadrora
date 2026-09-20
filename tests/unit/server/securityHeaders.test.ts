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
