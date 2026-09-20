import { createMiddleware } from 'hono/factory';

import { REQUEST_ID_HEADER } from '../../shared/constants';
import type { AppEnv } from '../types';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestId = createMiddleware<AppEnv>(async (context, next) => {
  const supplied = context.req.header(REQUEST_ID_HEADER);
  const id = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID();

  context.set('requestId', id);
  context.header(REQUEST_ID_HEADER, id);
  await next();
});

