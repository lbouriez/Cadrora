import { describe, expect, it } from 'vitest';

import { normalizeEmbedding } from '../../../src/browser/faces/embedding';
import { canUseWebGpuRuntime, YUNET_INPUT_SIZE } from '../../../src/browser/faces/inference';
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
});
