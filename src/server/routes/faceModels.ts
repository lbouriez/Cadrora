import type { Hono } from 'hono';

import { ApiException } from '../../shared/errors/ApiError';
import type { AppEnv } from '../types';

const MODEL_KEYS = new Map([
  ['v1/face_detection_yunet_2023mar.onnx', 'models/v1/face_detection_yunet_2023mar.onnx'],
  ['v1/face_recognition_sface_2021dec.onnx', 'models/v1/face_recognition_sface_2021dec.onnx'],
]);

export function registerFaceModelRoutes(app: Hono<AppEnv>): void {
  app.get('/models/:version/:filename', async (context) => {
    const requested = `${context.req.param('version')}/${context.req.param('filename')}`;
    const storageKey = MODEL_KEYS.get(requested);
    if (!storageKey) throw new ApiException('MODEL_NOT_FOUND', 'errors.modelNotFound', 404);
    const object = await context.env.MODELS_BUCKET.get(storageKey);
    if (!object) throw new ApiException('MODEL_NOT_FOUND', 'errors.modelNotFound', 404);
    context.header('Cache-Control', 'public, max-age=31536000, immutable');
    context.header('Content-Type', 'application/octet-stream');
    context.header('Content-Length', String(object.size));
    context.header('ETag', object.httpEtag);
    return context.body(object.body);
  });
}
