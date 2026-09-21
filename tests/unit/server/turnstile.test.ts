import { describe, expect, it, vi } from 'vitest';

import {
  isTurnstileProtectedRequest,
  verifyTurnstile,
  verifyTurnstileDetailed,
} from '../../../src/server/middleware/turnstile';

describe('turnstile middleware route scope', () => {
  it.each([
    ['/api/v1/admin/login'],
    ['/api/v1/events/event-1/unlock'],
  ])('protects POST %s', (path) => {
    expect(isTurnstileProtectedRequest('POST', path)).toBe(true);
  });

  it('does not protect reads or unrelated writes', () => {
    expect(isTurnstileProtectedRequest('GET', '/api/v1/admin/login')).toBe(false);
    expect(isTurnstileProtectedRequest('POST', '/api/v1/admin/events')).toBe(false);
  });

  it('preserves only bounded Siteverify error codes for diagnostics', async () => {
    const fetcher: typeof fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      success: false,
      'error-codes': ['invalid-input-secret'],
    }), { headers: { 'Content-Type': 'application/json' } })));

    await expect(verifyTurnstileDetailed('proof-not-logged', 'secret-not-logged', undefined, fetcher)).resolves.toEqual({
      success: false,
      failure: 'rejected',
      errorCodes: ['invalid-input-secret'],
    });
    await expect(verifyTurnstile('proof-not-logged', 'secret-not-logged', undefined, fetcher)).resolves.toBe(false);
  });

  it('reports an unavailable Siteverify response without exposing a server secret', async () => {
    const fetcher: typeof fetch = vi.fn(() => Promise.resolve(new Response('temporarily unavailable', { status: 503 })));

    await expect(verifyTurnstileDetailed('proof-not-logged', undefined, undefined, fetcher)).resolves.toEqual({
      success: false,
      failure: 'missing-secret',
      errorCodes: [],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
