import { z } from 'zod';

import { ApiException } from '../../shared/errors/ApiError';

const CursorPayloadSchema = z.object({
  eventId: z.string().min(1).max(128),
  generation: z.number().int().nonnegative(),
  nextPartition: z.number().int().nonnegative(),
});

export type FaceSearchCursor = z.infer<typeof CursorPayloadSchema>;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  const derived = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`cadrora:face-search-cursor:v1:${secret}`),
  );
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signFaceSearchCursor(payload: FaceSearchCursor, secret?: string): Promise<string> {
  if (!secret) throw new ApiException('FACE_CURSOR_SIGNING_UNAVAILABLE', 'errors.faceSearchUnavailable', 503);
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(CursorPayloadSchema.parse(payload))));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(encoded));
  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyFaceSearchCursor(cursor: string, secret?: string): Promise<FaceSearchCursor> {
  if (!secret) throw new ApiException('FACE_CURSOR_SIGNING_UNAVAILABLE', 'errors.faceSearchUnavailable', 503);
  const [payload, signature] = cursor.split('.');
  if (!payload || !signature) throw new ApiException('INVALID_FACE_CURSOR', 'errors.invalidCursor', 400);
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) throw new Error('invalid signature');
    const decoded: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return CursorPayloadSchema.parse(decoded);
  } catch {
    throw new ApiException('INVALID_FACE_CURSOR', 'errors.invalidCursor', 400);
  }
}
