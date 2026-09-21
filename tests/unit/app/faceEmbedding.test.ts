import { describe, expect, it } from 'vitest';

import { normalizeEmbedding } from '../../../src/browser/faces/embedding';
import { canUseWebGpuRuntime, decodeYuNetHead, YUNET_INPUT_SIZE } from '../../../src/browser/faces/inference';
import { FACE_MODEL_MANIFEST } from '../../../src/browser/faces/modelManifest';
import { ModelManifestSchema } from '../../../src/shared/schemas';

describe('face embedding boundary', () => {
  it('returns exactly 128 finite L2-normalized dimensions', () => {
    const embedding = normalizeEmbedding(Array.from({ length: 128 }, (_, index) => index + 1));
    expect(embedding).toHaveLength(128);
    expect(embedding.every(Number.isFinite)).toBe(true);
    expect(Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1);
  });

  it('rejects wrong dimensions, non-finite values, and empty vectors', () => {
    expect(() => normalizeEmbedding([1, 2])).toThrow('FACE_EMBEDDING_DIMENSIONS');
    expect(() => normalizeEmbedding([...Array.from({ length: 127 }, () => 1), Number.NaN])).toThrow('FACE_EMBEDDING_NOT_FINITE');
    expect(() => normalizeEmbedding(Array.from({ length: 128 }, () => 0))).toThrow('FACE_EMBEDDING_EMPTY');
  });

  it('keeps every pinned model compatible with the frozen manifest contract', () => {
    for (const model of FACE_MODEL_MANIFEST.models) {
      expect(ModelManifestSchema.safeParse({
        id: model.id, version: model.version, license: model.license, sha256: model.sha256,
        byteSize: model.byteSize, dimensions: model.dimensions, preprocessing: model.preprocessing,
        metric: model.metric, immutableUrl: model.immutableUrl,
      }).success).toBe(true);
      expect(model.byteSize).toBeLessThanOrEqual(model.sizeBudgetBytes);
    }
  });

  it('uses the optional compact WebGPU runtime only when WebGPU and JSPI are both available', () => {
    const webGpu = { gpu: {} };
    const jspi = { promising: () => undefined, Suspending: class {} };

    expect(canUseWebGpuRuntime(true, webGpu, jspi)).toBe(true);
    expect(canUseWebGpuRuntime(false, webGpu, jspi)).toBe(false);
    expect(canUseWebGpuRuntime(true, {}, jspi)).toBe(false);
    expect(canUseWebGpuRuntime(true, webGpu, {})).toBe(false);
  });

  it('uses the fixed input shape required by the pinned YuNet detector artifact', () => {
    expect(YUNET_INPUT_SIZE).toBe(640);
  });

  it('decodes YuNet center offsets and logarithmic box dimensions using OpenCV geometry', () => {
    const stride = 8;
    const columns = YUNET_INPUT_SIZE / stride;
    const index = 5 * columns + 6;
    const cls = new Float32Array(columns * columns);
    const obj = new Float32Array(columns * columns);
    const bbox = new Float32Array(columns * columns * 4);
    const kps = new Float32Array(columns * columns * 10);
    cls[index] = 0.81;
    obj[index] = 1;
    bbox.set([0.5, 0.25, Math.log(4), Math.log(6)], index * 4);
    kps.set([5, 3, 8, 3, 6.5, 5, 5.25, 7, 7.75, 7], index * 10);

    const faces = decodeYuNetHead({ bbox, cls, kps, obj, stride }, 640, 640);

    expect(faces).toHaveLength(1);
    expect(faces[0]?.score).toBeCloseTo(0.9);
    expect(faces[0]?.box.x).toBeCloseTo(36);
    expect(faces[0]?.box.y).toBeCloseTo(18);
    expect(faces[0]?.box.width).toBeCloseTo(32);
    expect(faces[0]?.box.height).toBeCloseTo(48);
    expect(faces[0]?.landmarks[0]).toEqual({ x: 88, y: 64 });
  });
});
