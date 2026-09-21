import {
  createPasswordHash,
  isPasswordHashFormat,
  verifyPassword,
} from '../../auth/password';

export type EventPasswordVerification = 'valid' | 'mismatch' | 'invalid-hash' | 'crypto-error';

/** Event and admin passwords intentionally share one audited PBKDF2 format. */
export const hashEventPassword = createPasswordHash;

export async function verifyEventPasswordDetailed(
  password: string,
  encoded: string,
): Promise<EventPasswordVerification> {
  if (!isPasswordHashFormat(encoded)) return 'invalid-hash';
  try {
    return await verifyPassword(password, encoded) ? 'valid' : 'mismatch';
  } catch {
    return 'crypto-error';
  }
}

export async function verifyEventPassword(password: string, encoded: string): Promise<boolean> {
  return (await verifyEventPasswordDetailed(password, encoded)) === 'valid';
}
