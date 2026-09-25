import { describe, expect, it, vi } from 'vitest';

import { verifyAccountZone } from '../../../scripts/instances/accountPreflight.mjs';

const accountId = 'a'.repeat(32);
const token = 'not-a-real-token';

function response(result, success = true) {
  return { ok: true, json: async () => ({ success, result }) };
}

describe('isolated account preflight', () => {
  it('accepts only an active zone owned by the explicit account', async () => {
    const fetcher = vi.fn(async () => response([{ id: 'zone-id', name: 'ateliergiulia.com', status: 'active', account: { id: accountId } }]));
    await expect(verifyAccountZone({ accountId, hostname: 'ateliergiulia.com', token, fetcher }))
      .resolves.toEqual({ zoneId: 'zone-id', zoneName: 'ateliergiulia.com' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0].searchParams.get('account.id')).toBe(accountId);
  });

  it('finds an active parent zone for a subdomain', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([{ id: 'parent', name: 'example.com', status: 'active', account: { id: accountId } }]));
    await expect(verifyAccountZone({ accountId, hostname: 'alice.example.com', token, fetcher }))
      .resolves.toEqual({ zoneId: 'parent', zoneName: 'example.com' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects another account or a pending zone before provisioning', async () => {
    const wrongAccount = vi.fn(async () => response([{ name: 'example.com', status: 'active', account: { id: 'b'.repeat(32) } }]));
    await expect(verifyAccountZone({ accountId, hostname: 'example.com', token, fetcher: wrongAccount }))
      .rejects.toThrow('No active Cloudflare zone');
    const pending = vi.fn(async () => response([{ name: 'example.com', status: 'pending', account: { id: accountId } }]));
    await expect(verifyAccountZone({ accountId, hostname: 'example.com', token, fetcher: pending }))
      .rejects.toThrow('not active');
  });

  it('fails closed when access is absent or the provider response is invalid', async () => {
    await expect(verifyAccountZone({ accountId, hostname: 'example.com', token: '' }))
      .rejects.toThrow('CLOUDFLARE_API_TOKEN');
    await expect(verifyAccountZone({ accountId, hostname: 'example.com', token, fetcher: async () => response(null) }))
      .rejects.toThrow('invalid response');
  });
});
