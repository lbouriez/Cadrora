import { describe, expect, it } from 'vitest';

import { ApiErrorSchema } from '../../../src/shared/schemas';
import { app } from '../../../src/server/app';

describe('worker app', () => {
  it('returns a JSON API 404 with a request id and no HTML fallback', async () => {
    const response = await app.request('/api/v1/not-a-route');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.code).toBe('ROUTE_NOT_FOUND');
    expect(body.requestId).not.toBe('');
  });

  it('does not retain the retired events API alias', async () => {
    const response = await app.request('/api/v1/events');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(body.code).toBe('ROUTE_NOT_FOUND');
  });
});
