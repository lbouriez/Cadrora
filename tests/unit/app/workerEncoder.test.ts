import { afterEach, expect, it, vi } from 'vitest';

const encodeServicePhoto = vi.hoisted(() => vi.fn());
vi.mock('../../../src/browser/images/encoder', () => ({ encodeServicePhoto, encodePhoto: vi.fn() }));
import { createImageEncoder } from '../../../src/browser/images/workerEncoder';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('preserves the selected compression after a Worker runtime failure and on subsequent uploads', async () => {
  const posted = vi.fn();
  const terminated = vi.fn();
  class FailedWorker {
    onError?: () => void;
    addEventListener(type: string, listener: () => void) { if (type === 'error') this.onError = listener; }
    postMessage(message: unknown) { posted(message); this.onError?.(); }
    terminate() { terminated(); }
  }
  vi.stubGlobal('Worker', FailedWorker);
  vi.stubGlobal('OffscreenCanvas', class {});
  const result = { width: 3000, height: 2000, variants: [] };
  encodeServicePhoto.mockResolvedValue(result);
  const encoder = createImageEncoder();
  const file = new File(['image'], 'source.jpg');
  await expect(encoder.encodeService(file, 'lighter')).resolves.toBe(result);
  expect(posted).toHaveBeenCalledWith(expect.objectContaining({ file, compression: 'lighter', recipe: 'service' }));
  expect(encodeServicePhoto).toHaveBeenLastCalledWith(file, 'lighter');
  await encoder.encodeService(file, 'balanced');
  expect(encodeServicePhoto).toHaveBeenLastCalledWith(file, 'balanced');
  expect(posted).toHaveBeenCalledOnce();
  expect(terminated).toHaveBeenCalledOnce();
  encoder.dispose();
});
