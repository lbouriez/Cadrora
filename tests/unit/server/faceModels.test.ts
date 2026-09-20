import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { errorBoundary } from '../../../src/server/middleware/errorBoundary';
import { requestId } from '../../../src/server/middleware/requestId';
import { registerFaceModelRoutes } from '../../../src/server/routes/faceModels';
import type { AppEnv } from '../../../src/server/types';

describe('face model route', () => {
  it('serves only manifest-approved model keys with immutable caching', async () => {
    const get = vi.fn().mockResolvedValue({
      body: new Response('model').body,
      size: 5,
      httpEtag: '"model-etag"',
    });
    const app = new Hono<AppEnv>();
    app.use('*', requestId);
    app.onError(errorBoundary);
    registerFaceModelRoutes(app);
    const bindings = { MODELS_BUCKET: { get } };
    const found = await app.request('/models/v1/face_detection_yunet_2023mar.onnx', {}, bindings);
    expect(found.status).toBe(200);
    expect(found.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(get).toHaveBeenCalledWith('models/v1/face_detection_yunet_2023mar.onnx');
    const missing = await app.request('/models/v1/not-approved.onnx', {}, bindings);
    expect(missing.status).toBe(404);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
