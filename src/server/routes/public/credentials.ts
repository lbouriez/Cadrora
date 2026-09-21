import {
  createEventPasswordHash,
  isAuthPepper,
  isPasswordHashFormat,
  verifyEventPasswordHash,
} from '../../auth/password';

export const SHOWCASE_PRIVATE_EVENT_ID = 'demo-private';
export const SHOWCASE_PRIVATE_EVENT_PASSWORD = 'cadrora-demo';

export type EventPasswordVerification = 'valid' | 'mismatch' | 'invalid-hash' | 'missing-pepper' | 'crypto-error';

/** Event credentials use a distinct AUTH_PEPPER HMAC domain from admin credentials. */
export const hashEventPassword = createEventPasswordHash;

/**
 * The showcase credential is intentionally public and never grants access to a
 * real event. Its legacy portable seed hash is therefore not derived at runtime.
 */
export function isShowcasePrivateEventPassword(
  eventId: string,
  password: string,
  showcaseEnabled: string | undefined,
): boolean {
  return showcaseEnabled === 'true'
    && eventId === SHOWCASE_PRIVATE_EVENT_ID
    && password === SHOWCASE_PRIVATE_EVENT_PASSWORD;
}

export async function verifyEventPasswordDetailed(
  password: string,
  encoded: string,
  pepper: string | undefined,
): Promise<EventPasswordVerification> {
  if (!isPasswordHashFormat(encoded)) return 'invalid-hash';
  if (!isAuthPepper(pepper)) return 'missing-pepper';
  try {
    return await verifyEventPasswordHash(password, encoded, pepper) ? 'valid' : 'mismatch';
  } catch {
    return 'crypto-error';
  }
}

export async function verifyEventPassword(password: string, encoded: string, pepper: string | undefined): Promise<boolean> {
  return (await verifyEventPasswordDetailed(password, encoded, pepper)) === 'valid';
}
