import { z } from 'zod';

import { SessionSchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';

const jwtHeaderSchema = z.object({
  alg: z.literal('RS256'),
  kid: z.string().min(1).max(512),
}).passthrough();
const jwtPayloadSchema = z.object({
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  email: z.string().min(1).max(320).optional(),
  exp: z.number().finite(),
  iss: z.string().url(),
  sub: z.string().min(1).max(320),
}).passthrough();
const jwkSchema = z.object({
  alg: z.literal('RS256').optional(),
  e: z.string().min(1),
  kid: z.string().min(1),
  kty: z.literal('RSA'),
  n: z.string().min(1),
  use: z.literal('sig').optional(),
});
const jwksSchema = z.object({ keys: z.array(jwkSchema).min(1) });

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export interface AccessVerificationOptions {
  fetcher?: typeof fetch;
  now?: () => number;
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64URL.test(value)) return null;
  try {
    const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJson(value: string): unknown {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    return JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

function accessIssuer(teamDomain: string | undefined): string | null {
  if (!teamDomain) return null;
  try {
    const url = new URL(teamDomain.startsWith('http') ? teamDomain : `https://${teamDomain}`);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hasAudience(value: string | string[], expected: string): boolean {
  return typeof value === 'string' ? value === expected : value.includes(expected);
}

/**
 * Verifies a Cloudflare Access assertion on the Worker itself. This deliberately
 * does not trust hostname or Cloudflare edge headers beyond the signed JWT.
 */
export async function verifyCloudflareAccessJwt(
  token: string | undefined,
  teamDomain: string | undefined,
  audience: string | undefined,
  options: AccessVerificationOptions = {},
): Promise<Session | null> {
  if (!token || !audience) return null;
  const issuer = accessIssuer(teamDomain);
  if (!issuer) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  if (!headerSegment || !payloadSegment || !signatureSegment) return null;
  const header = jwtHeaderSchema.safeParse(decodeJson(headerSegment));
  const payload = jwtPayloadSchema.safeParse(decodeJson(payloadSegment));
  const signature = decodeBase64Url(signatureSegment);
  if (!header.success || !payload.success || !signature) return null;
  if (payload.data.iss !== issuer || !hasAudience(payload.data.aud, audience)) return null;
  const nowSeconds = Math.floor((options.now ?? Date.now)() / 1_000);
  if (payload.data.exp <= nowSeconds) return null;

  try {
    const response = await (options.fetcher ?? fetch)(`${issuer}/cdn-cgi/access/certs`);
    if (!response.ok) return null;
    const keys = jwksSchema.safeParse(await response.json());
    if (!keys.success) return null;
    const jwk = keys.data.keys.find((candidate) => candidate.kid === header.data.kid);
    if (!jwk) return null;
    const publicKey: JsonWebKey = {
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n,
      ...(jwk.alg ? { alg: jwk.alg } : {}),
      ...(jwk.use ? { use: jwk.use } : {}),
    };
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signedData = encoder.encode(`${headerSegment}.${payloadSegment}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
    if (!valid) return null;

    const expiresAt = new Date(payload.data.exp * 1_000).toISOString();
    return SessionSchema.parse({
      id: `access:${payload.data.sub}`,
      authMode: 'cloudflare-access',
      subject: payload.data.email ?? payload.data.sub,
      createdAt: new Date(nowSeconds * 1_000).toISOString(),
      expiresAt,
      revokedAt: null,
    });
  } catch {
    return null;
  }
}
