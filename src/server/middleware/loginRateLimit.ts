import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

import { apiErrorResponse } from '../http/apiErrorResponse';
import type { AppEnv } from '../types';

interface LoginRateLimitOptions {
  limit: number;
  now: () => number;
  windowMs: number;
}

const failures = new Map<string, number[]>();
const defaults: LoginRateLimitOptions = {
  limit: 5,
  now: Date.now,
  windowMs: 15 * 60_000,
};

function clientKey(context: Context<AppEnv>): string {
  return context.req.header('CF-Connecting-IP') ?? 'local';
}

async function accountScope(context: Context<AppEnv>): Promise<'demo' | 'owner' | undefined> {
  try {
    const input: unknown = await context.req.raw.clone().json();
    if (!input || typeof input !== 'object' || !('account' in input)) return undefined;
    return input.account === 'demo' || input.account === 'owner' ? input.account : undefined;
  } catch {
    return undefined;
  }
}

function recentFailures(client: string, settings: LoginRateLimitOptions): number[] {
  const now = settings.now();
  const recent = (failures.get(client) ?? []).filter((timestamp) => timestamp > now - settings.windowMs);
  if (recent.length) failures.set(client, recent);
  else failures.delete(client);
  return recent;
}

export function createLoginRateLimit(options: Partial<LoginRateLimitOptions> = {}) {
  const settings = { ...defaults, ...options };
  return createMiddleware<AppEnv>(async (context, next) => {
    const recent = recentFailures(loginClientKey(context, await accountScope(context)), settings);
    if (recent.length >= settings.limit) {
      context.header('Retry-After', String(Math.ceil(settings.windowMs / 1_000)));
      context.res = apiErrorResponse(context, 429, 'LOGIN_RATE_LIMITED', 'errors.loginRateLimited');
      return;
    }
    await next();
  });
}

export function recordFailedLogin(client: string, now = Date.now()): void {
  failures.set(client, [...(failures.get(client) ?? []), now]);
}

export function loginClientKey(context: Context<AppEnv>, account?: 'demo' | 'owner'): string {
  const client = clientKey(context);
  return account ? `${client}:${account}` : client;
}

export function clearFailedLogins(client: string): void {
  failures.delete(client);
}

export function resetLoginRateLimitForTests(): void {
  failures.clear();
}

export const loginRateLimit = createLoginRateLimit();
