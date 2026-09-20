import { z } from 'zod';

import { DEFAULT_SESSION_TTL_HOURS } from '../../shared/constants';
import { EventGrantSchema } from '../../shared/schemas';
import type { EventGrant } from '../../shared/schemas';

export const EVENT_GRANT_COOKIE = '__Host-cadrora-event-grant';

const SignedGrantSchema = EventGrantSchema.extend({
  exp: z.number().int().positive(),
});
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  const material = encoder.encode(`cadrora:event-grant:v1\0${secret}`);
  const derived = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', derived, { hash: 'SHA-256', name: 'HMAC' }, false, ['sign', 'verify']);
}

function ttlHours(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 24 ? parsed : DEFAULT_SESSION_TTL_HOURS;
}

export async function createEventGrantToken(
  grant: EventGrant,
  secret: string,
  ttlSetting: string | undefined,
  now = new Date(),
): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        ...EventGrantSchema.parse(grant),
        exp: Math.floor(now.getTime() / 1_000) + ttlHours(ttlSetting) * 60 * 60,
      }),
    ),
  );
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyEventGrantToken(
  token: string,
  secret: string | undefined,
  now = new Date(),
): Promise<EventGrant | null> {
  if (!secret || !TOKEN_PATTERN.test(token)) return null;
  const [payload, encodedSignature] = token.split('.');
  if (!payload || !encodedSignature) return null;
  const signature = base64UrlDecode(encodedSignature);
  const payloadBytes = base64UrlDecode(payload);
  if (!signature || !payloadBytes) return null;

  const valid = await crypto.subtle.verify(
    'HMAC',
    await signingKey(secret),
    signature.buffer as ArrayBuffer,
    encoder.encode(payload),
  );
  if (!valid) return null;

  try {
    const parsed = SignedGrantSchema.safeParse(JSON.parse(decoder.decode(payloadBytes)) as unknown);
    if (!parsed.success || parsed.data.exp <= Math.floor(now.getTime() / 1_000)) return null;
    return { eventId: parsed.data.eventId, accessVersion: parsed.data.accessVersion };
  } catch {
    return null;
  }
}

export function readEventGrantToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(';')) {
    const [name, ...valueParts] = piece.trim().split('=');
    if (name !== EVENT_GRANT_COOKIE) continue;
    const value = valueParts.join('=');
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

export async function eventGrantCookie(
  grant: EventGrant,
  secret: string,
  ttlSetting: string | undefined,
  now = new Date(),
): Promise<string> {
  const hours = ttlHours(ttlSetting);
  const token = await createEventGrantToken(grant, secret, ttlSetting, now);
  const expires = new Date(now.getTime() + hours * 60 * 60 * 1_000);
  return `${EVENT_GRANT_COOKIE}=${token}; Path=/; Expires=${expires.toUTCString()}; Max-Age=${hours * 60 * 60}; HttpOnly; Secure; SameSite=Strict`;
}

