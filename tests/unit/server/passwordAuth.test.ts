import { describe, expect, it } from 'vitest';

import { PASSWORD_HASH_FORMAT, createPasswordHash, verifyPassword } from '../../../src/server/auth';

const authPepper = 'test-auth-pepper-that-is-at-least-thirty-two-bytes';

describe('password authentication', () => {
  it('uses a salted domain-separated HMAC hash and rejects incorrect passwords', async () => {
    const hash = await createPasswordHash('a long test password that is not a production secret', authPepper);

    expect(hash).toMatch(/^hmac-sha256\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('a long test password');
    await expect(verifyPassword('a long test password that is not a production secret', hash, authPepper)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', hash, authPepper)).resolves.toBe(false);
    await expect(verifyPassword('a long test password that is not a production secret', hash, `${authPepper}-other`)).resolves.toBe(false);
  });

  it('fails closed for an absent pepper or a legacy PBKDF2 format', async () => {
    expect(PASSWORD_HASH_FORMAT).toContain('hmac-sha256');
    await expect(verifyPassword('password', undefined, authPepper)).resolves.toBe(false);
    await expect(verifyPassword('password', 'pbkdf2-sha256$600000$salt$hash', authPepper)).resolves.toBe(false);
    await expect(verifyPassword('password', 'hmac-sha256$salt$hash', undefined)).resolves.toBe(false);
  });
});
