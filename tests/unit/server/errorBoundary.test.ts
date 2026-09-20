import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { ApiException } from '../../../src/shared/errors/ApiError';
import { ApiErrorSchema } from '../../../src/shared/schemas';
import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import type { AppEnv } from '../../../src/server/types';

describe('errorBoundary middleware', () => {
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
});
