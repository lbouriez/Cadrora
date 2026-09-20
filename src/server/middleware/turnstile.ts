import { createMiddleware } from 'hono/factory';
import { z } from 'zod';

import { TurnstileTokenSchema } from '../../shared/schemas';
import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

const UNLOCK_PATH = /^\/api\/v1\/events\/[^/]+\/unlock$/;

export function isTurnstileProtectedRequest(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }

  return path === '/api/v1/admin/login' || UNLOCK_PATH.test(path);
}

const turnstileResponseSchema = z.object({ success: z.boolean() }).passthrough();

export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  clientIp: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret) return false;
  const payload = new URLSearchParams({ response: token, secret });
  if (clientIp) payload.set('remoteip', clientIp);

  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: payload,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    if (!response.ok) return false;
    const result = turnstileResponseSchema.safeParse(await response.json());
    return result.success && result.data.success;
  } catch {
    return false;
  }
}

export const turnstile = createMiddleware<AppEnv>(async (context, next) => {
  if (!isTurnstileProtectedRequest(context.req.method, context.req.path)) {
    await next();
    return;
  }

  const rawBody: unknown = await context.req.raw.clone().json().catch(() => null);
  const parsedToken = typeof rawBody === 'object' && rawBody !== null && 'turnstileToken' in rawBody
    ? TurnstileTokenSchema.safeParse(rawBody.turnstileToken)
    : null;
  if (!parsedToken?.success) {
    throw new ApiException('TURNSTILE_REQUIRED', 'errors.turnstileRequired', 400);
  }
  if (!context.env.TURNSTILE_SECRET_KEY) {
    throw new ApiException('TURNSTILE_UNAVAILABLE', 'errors.turnstileUnavailable', 503);
  }
  const verified = await verifyTurnstile(
    parsedToken.data,
    context.env.TURNSTILE_SECRET_KEY,
    context.req.header('CF-Connecting-IP') ?? undefined,
  );
  if (!verified) {
    throw new ApiException('TURNSTILE_FAILED', 'errors.turnstileFailed', 403);
  }

  await next();
});
