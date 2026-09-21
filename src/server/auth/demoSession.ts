import { z } from 'zod';

import { SessionSchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';

export const DEMO_SESSION_COOKIE = '__Host-cadrora-demo';
const DEMO_SESSION_TTL_SECONDS = 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const payloadSchema = z.object({
  expiresAt: z.number().int().positive(),
  issuedAt: z.number().int().positive(),
  nonce: z.string().uuid(),
  version: z.literal(1),
});

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown): string {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`cadrora-demo-session-v1:${secret}`),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(value));
  return encodeBytes(new Uint8Array(signature));
}

function sessionFromPayload(payload: z.infer<typeof payloadSchema>): Session {
  return SessionSchema.parse({
    access: 'read-only',
    authMode: 'demo',
    createdAt: new Date(payload.issuedAt * 1_000).toISOString(),
    expiresAt: new Date(payload.expiresAt * 1_000).toISOString(),
    id: `demo:${payload.nonce}`,
    revokedAt: null,
    subject: 'demo',
  });
}

export async function createDemoSession(secret: string, now = new Date()): Promise<{ session: Session; token: string }> {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const payload = payloadSchema.parse({
    expiresAt: issuedAt + DEMO_SESSION_TTL_SECONDS,
    issuedAt,
    nonce: crypto.randomUUID(),
    version: 1,
  });
  const encoded = encodeJson(payload);
  return { session: sessionFromPayload(payload), token: `${encoded}.${await sign(encoded, secret)}` };
}

export function readDemoSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(';')) {
    const [name, ...valueParts] = piece.trim().split('=');
    if (name !== DEMO_SESSION_COOKIE) continue;
    const token = valueParts.join('=');
    return TOKEN_PATTERN.test(token) ? token : null;
  }
  return null;
}

export async function verifyDemoSession(token: string, secret: string, now = new Date()): Promise<Session | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  try {
    const [encoded = '', signature = ''] = token.split('.');
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      decodeBytes(signature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;
    const value: unknown = JSON.parse(new TextDecoder().decode(decodeBytes(encoded)));
    const payload = payloadSchema.safeParse(value);
    if (!payload.success || payload.data.expiresAt <= Math.floor(now.getTime() / 1_000)) return null;
    return sessionFromPayload(payload.data);
  } catch {
    return null;
  }
}

export function demoSessionCookie(token: string, expiresAt: string, now = new Date()): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid demo session token');
  const expires = new Date(expiresAt);
  const maxAge = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1_000));
  return `${DEMO_SESSION_COOKIE}=${token}; Path=/; Expires=${expires.toUTCString()}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredDemoSessionCookie(): string {
  return `${DEMO_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
