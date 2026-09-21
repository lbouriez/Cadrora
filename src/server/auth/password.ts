const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 600_000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
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

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  // PBKDF2 output is fixed length. Do not return early for a mismatched byte.
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, PASSWORD_HASH_BYTES, 'sha256', (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(new Uint8Array(derived));
    });
  });
}

interface ParsedPasswordHash {
  hash: Uint8Array;
  iterations: number;
  salt: Uint8Array;
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const [prefix, iterationText, saltText, hashText, extra] = value.split('$');
  if (prefix !== PASSWORD_HASH_PREFIX || !iterationText || !saltText || !hashText || extra !== undefined) return null;

  const iterations = Number(iterationText);
  if (!Number.isSafeInteger(iterations) || iterations < PASSWORD_HASH_ITERATIONS || iterations > 2_000_000) return null;

  const salt = base64UrlDecode(saltText);
  const hash = base64UrlDecode(hashText);
  if (!salt || salt.length < PASSWORD_SALT_BYTES || !hash || hash.length !== PASSWORD_HASH_BYTES) return null;
  return { hash, iterations, salt };
}

export function isPasswordHashFormat(value: string | undefined): boolean {
  return value !== undefined && parsePasswordHash(value) !== null;
}

/**
 * Produces the only accepted ADMIN_SECRET_HASH format:
 * pbkdf2-sha256$600000$base64url-salt$base64url-derived-key.
 * This helper is intended for setup tooling; callers must never log its result.
 */
export async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await derive(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

/** Verifies a configured password hash without data-dependent early byte exits. */
export async function verifyPassword(password: string, configuredHash: string | undefined): Promise<boolean> {
  if (!configuredHash) return false;
  const parsed = parsePasswordHash(configuredHash);
  if (!parsed) return false;
  const actual = await derive(password, parsed.salt, parsed.iterations);
  return equalBytes(actual, parsed.hash);
}

export const PASSWORD_HASH_FORMAT = `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$base64url-salt$base64url-derived-key`;
import { pbkdf2 } from 'node:crypto';
