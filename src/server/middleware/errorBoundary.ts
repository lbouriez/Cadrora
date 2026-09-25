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

  if (isD1DailyQuotaError(error)) {
    return apiErrorResponse(context, 503, 'D1_DAILY_QUOTA_EXCEEDED', 'errors.d1DailyQuotaExceeded');
  }

  console.error('cadrora_unhandled_request_error', {
    // Provider errors may include private object keys or request payloads in
    // their message. Keep diagnostics classified, never copy exception text.
    errorCategory: error instanceof TypeError ? 'type' : error instanceof SyntaxError ? 'syntax' : 'unexpected',
    requestId: context.get('requestId'),
  });

  return apiErrorResponse(context, 500, 'INTERNAL_ERROR', 'errors.internal');
};

function isD1DailyQuotaError(error: unknown): boolean {
  // D1 may prefix its documented limit message with D1_ERROR. Match the
  // specific provider wording so unrelated quota or database errors stay generic.
  const message = error instanceof Error ? error.message : '';
  return message.includes("Your account has exceeded D1's free tier daily row read limit") ||
    message.includes("Your account has exceeded D1's free tier daily row write limit");
}
