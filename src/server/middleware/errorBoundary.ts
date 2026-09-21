import type { ErrorHandler } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import { apiErrorResponse } from '../http/apiErrorResponse';
import type { AppEnv } from '../types';

export const errorBoundary: ErrorHandler<AppEnv> = (error, context) => {
  if (error instanceof ApiException) {
    return apiErrorResponse(
      context,
      error.status as 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 503,
      error.code,
      error.message,
    );
  }

  console.error('cadrora_unhandled_request_error', {
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    errorName: error instanceof Error ? error.name : typeof error,
    requestId: context.get('requestId'),
  });

  return apiErrorResponse(context, 500, 'INTERNAL_ERROR', 'errors.internal');
};
