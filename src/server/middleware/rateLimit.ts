import { createMiddleware } from 'hono/factory';

import { apiErrorResponse } from '../http/apiErrorResponse';
import type { AppEnv } from '../types';

interface RateLimitOptions {
  limit: number;
  now: () => number;
  windowMs: number;
}

const hits = new Map<string, number[]>();
const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 120,
  now: Date.now,
  windowMs: 60_000,
};

function compact(now: number): void {
  if (hits.size < 5_000) return;

  for (const [key, timestamps] of hits) {
    if (timestamps.at(-1) === undefined || timestamps.at(-1)! < now - 60_000) {
      hits.delete(key);
    }
  }
}

export function createRateLimit(options: Partial<RateLimitOptions> = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  return createMiddleware<AppEnv>(async (context, next) => {
    const now = settings.now();
    compact(now);
    const client = context.req.header('CF-Connecting-IP') ?? 'local';
    const key = `${client}:${context.req.path}`;
    const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > now - settings.windowMs);

    if (recent.length >= settings.limit) {
      context.header('Retry-After', String(Math.ceil(settings.windowMs / 1_000)));
      context.res = apiErrorResponse(context, 429, 'RATE_LIMITED', 'errors.rateLimited');
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    await next();
  });
}

export function resetRateLimitForTests(): void {
  hits.clear();
}

export const rateLimit = createRateLimit();

