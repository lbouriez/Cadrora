import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiException } from '../../../src/shared/errors/ApiError';
import { ApiErrorSchema } from '../../../src/shared/schemas';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('errorBoundary middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a stable API error without a stack', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.get('/test', () => {
      throw new ApiException('NOPE', 'errors.nope', 403);
    });

    const response = await app.request('/test');
    const body = ApiErrorSchema.parse(await response.json());

    expect(response.status).toBe(403);
    expect(body.code).toBe('NOPE');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it.each(['read', 'write'])('classifies a D1 daily row %s limit without exposing provider text', async (operation) => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.get('/test', () => {
      throw new Error(`D1_ERROR: Your account has exceeded D1's free tier daily row ${operation} limit. Private detail.`);
    });

    const response = await app.request('/test');
    const body = ApiErrorSchema.parse(await response.json());
    expect(response.status).toBe(503);
    expect(body.code).toBe('D1_DAILY_QUOTA_EXCEEDED');
    expect(body.message).toBe('errors.d1DailyQuotaExceeded');
    expect(JSON.stringify(body)).not.toContain('Private detail');
  });

  it('logs safe diagnostics for unexpected errors without exposing a stack', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    app.get('/test', () => {
      throw new Error('private key: secret-value');
    });

    const response = await app.request('/test', { headers: { 'x-request-id': 'error-test' } });

    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith('cadrora_unhandled_request_error', {
      errorCategory: 'unexpected',
      requestId: 'error-test',
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/stack|secret-value/u);
  });
});
