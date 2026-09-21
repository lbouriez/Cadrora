const ITERATIONS = 210_000;

export type EventPasswordVerification = 'valid' | 'mismatch' | 'invalid-hash' | 'crypto-error';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    passwordKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign'],
  );
  const raw = await crypto.subtle.exportKey('raw', derivedKey);
  if (!(raw instanceof ArrayBuffer)) throw new Error('PBKDF2 export did not return bytes');
  return new Uint8Array(raw);
}

export async function hashEventPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

export async function verifyEventPasswordDetailed(
  password: string,
  encoded: string,
): Promise<EventPasswordVerification> {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !expectedText) {
    return 'invalid-hash';
  }
  try {
    const actual = await derive(password, base64UrlToBytes(saltText), iterations);
    const expected = base64UrlToBytes(expectedText);
    if (actual.length !== expected.length) return 'invalid-hash';
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) {
      difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
    }
    return difference === 0 ? 'valid' : 'mismatch';
  } catch {
    return 'crypto-error';
  }
}

export async function verifyEventPassword(password: string, encoded: string): Promise<boolean> {
  return (await verifyEventPasswordDetailed(password, encoded)) === 'valid';
}
