const PASSWORD_HASH_PREFIX = 'hmac-sha256';
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 32;
const AUTH_PEPPER_MIN_BYTES = 32;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const encoder = new TextEncoder();

export type PasswordHashPurpose = 'admin' | 'event';

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
  // HMAC output is fixed length. Do not return early for a mismatched byte.
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

function passwordInput(saltText: string, password: string): Uint8Array {
  // The salt is base64url and cannot contain a colon, so this input is unambiguous.
  return encoder.encode(`${saltText}:${password}`);
}

async function pepperKey(pepper: string, purpose: PasswordHashPurpose): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`cadrora-password-${purpose}-v1:${pepper}`),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
}

async function mac(password: string, saltText: string, pepper: string, purpose: PasswordHashPurpose): Promise<Uint8Array> {
  const signature = await crypto.subtle.sign('HMAC', await pepperKey(pepper, purpose), passwordInput(saltText, password));
  return new Uint8Array(signature);
}

interface ParsedPasswordHash {
  hash: Uint8Array;
  saltText: string;
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const [prefix, saltText, hashText, extra] = value.split('$');
  if (prefix !== PASSWORD_HASH_PREFIX || !saltText || !hashText || extra !== undefined) return null;

  const salt = base64UrlDecode(saltText);
  const hash = base64UrlDecode(hashText);
  if (!salt || salt.length < PASSWORD_SALT_BYTES || !hash || hash.length !== PASSWORD_HASH_BYTES) return null;
  return { hash, saltText };
}

/** A random, server-only value of at least 32 bytes is required for every HMAC password domain. */
export function isAuthPepper(value: string | undefined): value is string {
  return value !== undefined && encoder.encode(value).byteLength >= AUTH_PEPPER_MIN_BYTES;
}

export function isPasswordHashFormat(value: string | undefined): boolean {
  return value !== undefined && parsePasswordHash(value) !== null;
}

async function createPepperedPasswordHash(
  password: string,
  pepper: string,
  purpose: PasswordHashPurpose,
): Promise<string> {
  if (!isAuthPepper(pepper)) throw new Error('AUTH_PEPPER is missing or too short');
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const saltText = base64UrlEncode(salt);
  const hash = await mac(password, saltText, pepper, purpose);
  return `${PASSWORD_HASH_PREFIX}$${saltText}$${base64UrlEncode(hash)}`;
}

async function verifyPepperedPassword(
  password: string,
  configuredHash: string | undefined,
  pepper: string | undefined,
  purpose: PasswordHashPurpose,
): Promise<boolean> {
  if (!configuredHash || !isAuthPepper(pepper)) return false;
  const parsed = parsePasswordHash(configuredHash);
  if (!parsed) return false;
  const actual = await mac(password, parsed.saltText, pepper, purpose);
  return equalBytes(actual, parsed.hash);
}

/** Produces the password-admin HMAC format without consuming expensive Worker CPU. */
export function createPasswordHash(password: string, pepper: string): Promise<string> {
  return createPepperedPasswordHash(password, pepper, 'admin');
}

/** Verifies an admin password with a distinct HMAC key domain. */
export function verifyPassword(
  password: string,
  configuredHash: string | undefined,
  pepper: string | undefined,
): Promise<boolean> {
  return verifyPepperedPassword(password, configuredHash, pepper, 'admin');
}

/** Produces an event-password HMAC in a domain that cannot validate an admin password. */
export function createEventPasswordHash(password: string, pepper: string): Promise<string> {
  return createPepperedPasswordHash(password, pepper, 'event');
}

/** Verifies an event password with the event-specific HMAC key domain. */
export function verifyEventPasswordHash(
  password: string,
  configuredHash: string | undefined,
  pepper: string | undefined,
): Promise<boolean> {
  return verifyPepperedPassword(password, configuredHash, pepper, 'event');
}

export const PASSWORD_HASH_FORMAT = `${PASSWORD_HASH_PREFIX}$base64url-salt$base64url-mac`;
