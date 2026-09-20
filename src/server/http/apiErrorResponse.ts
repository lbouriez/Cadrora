import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ApiError } from '../../shared/schemas';
import type { AppEnv } from '../types';

export function apiErrorResponse(
  context: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  const body: ApiError = {
    code,
    message,
    requestId: context.get('requestId'),
  };

  return context.json(body, status);
}

