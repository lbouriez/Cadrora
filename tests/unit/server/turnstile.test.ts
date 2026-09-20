import { describe, expect, it } from 'vitest';

import { isTurnstileProtectedRequest } from '../../../src/server/middleware/turnstile';

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
});

