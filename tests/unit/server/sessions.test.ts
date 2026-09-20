import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_COOKIE,
  createPasswordSession,
  expiredSessionCookie,
  getPasswordSession,
  readSessionToken,
  revokePasswordSession,
  rotatePasswordSession,
  sessionCookie,
} from '../../../src/server/auth';

interface StoredRow {
  auth_mode: 'password';
  created_at: string;
  expires_at: string;
  id: string;
  revoked_at: string | null;
  subject: string;
  token_hash: string;
}

class FakeSessionDatabase {
  readonly rows = new Map<string, StoredRow>();

  readonly database = {
    prepare: (query: string) => ({
      bind: (...values: unknown[]) => ({
        first: <T>(): Promise<T | null> => {
          if (!query.startsWith('SELECT')) return Promise.resolve(null);
          const hash = values[0];
          const now = values[1];
          if (typeof hash !== 'string' || typeof now !== 'string') return Promise.resolve(null);
          const row = [...this.rows.values()].find(
            (candidate) => candidate.token_hash === hash && candidate.revoked_at === null && candidate.expires_at > now,
          );
          return Promise.resolve((row ? { ...row } : null) as T | null);
        },
        run: (): Promise<D1Result<unknown>> => {
          if (query.startsWith('INSERT')) {
            const [id, tokenHash, authMode, subject, createdAt, expiresAt] = values;
            if (
              typeof id === 'string' &&
              typeof tokenHash === 'string' &&
              authMode === 'password' &&
              typeof subject === 'string' &&
              typeof createdAt === 'string' &&
              typeof expiresAt === 'string'
            ) {
              this.rows.set(id, {
                auth_mode: 'password',
                created_at: createdAt,
                expires_at: expiresAt,
                id,
                revoked_at: null,
                subject,
                token_hash: tokenHash,
              });
            }
            return Promise.resolve({ meta: { changes: 1 } } as unknown as D1Result<unknown>);
          }
          if (query.startsWith('UPDATE')) {
            const [revokedAt, id] = values;
            const row = typeof id === 'string' ? this.rows.get(id) : undefined;
            if (row && row.revoked_at === null && typeof revokedAt === 'string') {
              row.revoked_at = revokedAt;
              return Promise.resolve({ meta: { changes: 1 } } as unknown as D1Result<unknown>);
            }
            return Promise.resolve({ meta: { changes: 0 } } as unknown as D1Result<unknown>);
          }
          return Promise.resolve({ meta: { changes: 0 } } as unknown as D1Result<unknown>);
        },
      }),
    }),
  } as unknown as D1Database;
}

describe('opaque password sessions', () => {
  it('stores only a token hash, sets a compliant Host cookie, and dies after revocation', async () => {
    const fake = new FakeSessionDatabase();
    const now = new Date('2030-01-01T00:00:00.000Z');
    const created = await createPasswordSession(fake.database, '8', 'admin', now);
    if (!created) throw new Error('Expected a session');

    expect([...fake.rows.values()][0]?.token_hash).not.toBe(created.token);
    expect(sessionCookie(created.token, created.session.expiresAt, now)).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(sessionCookie(created.token, created.session.expiresAt, now)).toContain('Path=/;');
    expect(sessionCookie(created.token, created.session.expiresAt, now)).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(readSessionToken(`${ADMIN_SESSION_COOKIE}=${created.token}`)).toBe(created.token);
    expect(await getPasswordSession(fake.database, created.token, now)).toMatchObject({ id: created.session.id });

    await expect(revokePasswordSession(fake.database, created.session.id, now)).resolves.toBe(true);
    await expect(getPasswordSession(fake.database, created.token, now)).resolves.toBeNull();
    expect(expiredSessionCookie()).toContain('Max-Age=0');
  });

  it('rotates a valid session and invalidates its prior token', async () => {
    const fake = new FakeSessionDatabase();
    const now = new Date('2030-01-01T00:00:00.000Z');
    const created = await createPasswordSession(fake.database, '8', 'admin', now);
    if (!created) throw new Error('Expected a session');

    const rotated = await rotatePasswordSession(fake.database, created.session, '8', now);
    if (!rotated) throw new Error('Expected a rotated session');
    expect(rotated.token).not.toBe(created.token);
    await expect(getPasswordSession(fake.database, created.token, now)).resolves.toBeNull();
    await expect(getPasswordSession(fake.database, rotated.token, now)).resolves.toMatchObject({ id: rotated.session.id });
  });

  it('treats expired rows and unsafe TTL configuration as unauthenticated', async () => {
    const fake = new FakeSessionDatabase();
    const now = new Date('2030-01-01T00:00:00.000Z');
    await expect(createPasswordSession(fake.database, '0', 'admin', now)).resolves.toBeNull();
    const created = await createPasswordSession(fake.database, '1', 'admin', now);
    if (!created) throw new Error('Expected a session');
    await expect(getPasswordSession(fake.database, created.token, new Date('2030-01-01T01:00:00.000Z'))).resolves.toBeNull();
  });
});
