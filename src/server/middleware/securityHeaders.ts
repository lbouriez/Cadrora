import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../types';

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' blob: data: https://www.google-analytics.com https://www.googletagmanager.com",
    "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com",
    'frame-src https://challenges.cloudflare.com https://www.google.com',
    "worker-src 'self' blob:",
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
} as const;

export const securityHeaders = createMiddleware<AppEnv>(async (context, next) => {
  await next();
  // Vite injects an inline React-refresh preamble in local HTML. Production
  // builds contain no inline application script, so only loopback development
  // omits CSP while retaining every other browser protection below.
  const hostname = new URL(context.req.url).hostname;
  const localDevelopment = hostname === '127.0.0.1' || hostname === 'localhost';
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'Content-Security-Policy' && localDevelopment) continue;
    context.header(name, value);
  }
});
