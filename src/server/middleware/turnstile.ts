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

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string().min(1).max(128)).max(10).optional(),
}).passthrough();

export type TurnstileVerification =
  | { errorCodes: string[]; failure: 'missing-secret' | 'network' | 'siteverify-http' | 'invalid-response' | 'rejected'; success: false }
  | { success: true };

/**
 * Retains only Siteverify's bounded error codes for operational diagnostics.
 * Request tokens, secrets, and visitor IPs must never reach Worker logs.
 */
export async function verifyTurnstileDetailed(
  token: string,
  secret: string | undefined,
  clientIp: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileVerification> {
  if (!secret) return { success: false, failure: 'missing-secret', errorCodes: [] };

  const payload = new URLSearchParams({ response: token, secret });
  if (clientIp) payload.set('remoteip', clientIp);

  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: payload,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    if (!response.ok) return { success: false, failure: 'siteverify-http', errorCodes: [] };
    const result = turnstileResponseSchema.safeParse(await response.json());
    if (!result.success) return { success: false, failure: 'invalid-response', errorCodes: [] };
    if (result.data.success) return { success: true };
    return { success: false, failure: 'rejected', errorCodes: result.data['error-codes'] ?? [] };
  } catch {
    return { success: false, failure: 'network', errorCodes: [] };
  }
}

export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  clientIp: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  return (await verifyTurnstileDetailed(token, secret, clientIp, fetcher)).success;
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
  const verification = await verifyTurnstileDetailed(
    parsedToken.data,
    context.env.TURNSTILE_SECRET_KEY,
    context.req.header('CF-Connecting-IP') ?? undefined,
  );
  if (!verification.success) {
    // This deliberately excludes the proof, secret, and remote IP. The resulting
    // log lets operators distinguish a stale/mismatched widget secret from a
    // rejected or expired visitor proof without revealing authentication material.
    console.warn('cadrora_turnstile_verification_failed', {
      errorCodes: verification.errorCodes,
      failure: verification.failure,
    });
    throw new ApiException('TURNSTILE_FAILED', 'errors.turnstileFailed', 403);
  }

  await next();
});
