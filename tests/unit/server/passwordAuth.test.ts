import { describe, expect, it } from 'vitest';

import { PASSWORD_HASH_FORMAT, createPasswordHash, verifyPassword } from '../../../src/server/auth';

describe('password authentication', () => {
  it('uses a salted PBKDF2 hash and rejects incorrect passwords', async () => {
    const hash = await createPasswordHash('a long test password that is not a production secret');

    expect(hash).toMatch(/^pbkdf2-sha256\$600000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('a long test password');
    await expect(verifyPassword('a long test password that is not a production secret', hash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', hash)).resolves.toBe(false);
  }, 30_000);

  it('fails closed for an absent or weaker configured format', async () => {
    expect(PASSWORD_HASH_FORMAT).toContain('600000');
    await expect(verifyPassword('password', undefined)).resolves.toBe(false);
    await expect(verifyPassword('password', 'pbkdf2-sha256$1$salt$hash')).resolves.toBe(false);
  });
});
