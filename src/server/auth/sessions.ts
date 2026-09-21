import { z } from 'zod';

import { DEFAULT_SESSION_TTL_HOURS } from '../../shared/constants';
import { SessionSchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';

export const ADMIN_SESSION_COOKIE = '__Host-cadrora-admin';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const storedSessionSchema = z.object({
  auth_mode: z.literal('password'),
  created_at: z.string(),
  expires_at: z.string(),
  id: z.string(),
  revoked_at: z.string().nullable(),
  subject: z.string(),
});

export interface CreatedSession {
  session: Session;
  token: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function sessionTtlHours(value: string | undefined): number | null {
  if (value === undefined || value === '') return DEFAULT_SESSION_TTL_HOURS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) return null;
  return parsed;
}

function asSession(row: unknown): Session | null {
  const parsed = storedSessionSchema.safeParse(row);
  if (!parsed.success) return null;
  const session = SessionSchema.safeParse({
    access: 'manage',
    id: parsed.data.id,
    authMode: 'password',
    subject: parsed.data.subject,
    createdAt: parsed.data.created_at,
    expiresAt: parsed.data.expires_at,
    revokedAt: parsed.data.revoked_at,
  });
  return session.success ? session.data : null;
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64UrlEncode(new Uint8Array(digest));
}

function newToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

function sessionExpiry(ttlHours: number, now: Date): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1_000);
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(';')) {
    const [name, ...valueParts] = piece.trim().split('=');
    if (name !== ADMIN_SESSION_COOKIE) continue;
    const token = valueParts.join('=');
    return TOKEN_PATTERN.test(token) ? token : null;
  }
  return null;
}

export function sessionCookie(token: string, expiresAt: string, now = new Date()): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid session token');
  const expires = new Date(expiresAt);
  const maxAge = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1_000));
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Expires=${expires.toUTCString()}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function createPasswordSession(
  database: D1Database,
  ttlSetting: string | undefined,
  subject = 'admin',
  now = new Date(),
): Promise<CreatedSession | null> {
  const ttlHours = sessionTtlHours(ttlSetting);
  if (ttlHours === null) return null;

  const token = newToken();
  const expiresAt = sessionExpiry(ttlHours, now).toISOString();
  const session: Session = SessionSchema.parse({
    access: 'manage',
    id: crypto.randomUUID(),
    authMode: 'password',
    subject,
    createdAt: now.toISOString(),
    expiresAt,
    revokedAt: null,
  });

  await database
    .prepare(
      'INSERT INTO sessions (id, token_hash, auth_mode, subject, created_at, expires_at, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)',
    )
    .bind(session.id, await tokenHash(token), session.authMode, session.subject, session.createdAt, session.expiresAt)
    .run();
  return { session, token };
}

export async function getPasswordSession(database: D1Database, token: string, now = new Date()): Promise<Session | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await database
    .prepare(
      'SELECT id, auth_mode, subject, created_at, expires_at, revoked_at FROM sessions WHERE token_hash = ?1 AND revoked_at IS NULL AND expires_at > ?2',
    )
    .bind(await tokenHash(token), now.toISOString())
    .first<unknown>();
  return asSession(row);
}

export async function revokePasswordSession(database: D1Database, sessionId: string, now = new Date()): Promise<boolean> {
  const result = await database
    .prepare('UPDATE sessions SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL')
    .bind(now.toISOString(), sessionId)
    .run();
  return result.meta.changes === 1;
}

export async function rotatePasswordSession(
  database: D1Database,
  current: Session,
  ttlSetting: string | undefined,
  now = new Date(),
): Promise<CreatedSession | null> {
  if (current.authMode !== 'password') return null;
  const revoked = await revokePasswordSession(database, current.id, now);
  if (!revoked) return null;
  return createPasswordSession(database, ttlSetting, current.subject, now);
}
