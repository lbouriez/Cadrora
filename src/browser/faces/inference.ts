import type { InferenceSession, Tensor } from 'onnxruntime-web';

import { normalizeEmbedding } from './embedding';
import { FACE_MODEL_MANIFEST } from './modelManifest';

export interface FaceLandmark { x: number; y: number }
export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number };
  landmarks: FaceLandmark[];
  score: number;
}

export interface FaceInferenceOptions {
  preferWebGpu?: boolean;
}

/** Fixed spatial input required by the checksum-pinned YuNet artifact. */
export const YUNET_INPUT_SIZE = 640;

/** The compact upstream WebGPU runtime requires WebAssembly JSPI as well as WebGPU. */
export function canUseWebGpuRuntime(
  preferWebGpu: boolean,
  browserNavigator: unknown,
  webAssemblyRuntime: unknown,
): boolean {
  return preferWebGpu
    && typeof browserNavigator === 'object'
    && browserNavigator !== null
    && 'gpu' in browserNavigator
    && typeof webAssemblyRuntime === 'object'
    && webAssemblyRuntime !== null
    && 'Suspending' in webAssemblyRuntime
    && 'promising' in webAssemblyRuntime;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifiedModel(asset: (typeof FACE_MODEL_MANIFEST.models)[number]): Promise<ArrayBuffer> {
  const cache = 'caches' in globalThis ? await caches.open(`cadrora-face-models-v${FACE_MODEL_MANIFEST.version}`) : null;
  const cached = await cache?.match(asset.url);
  if (cached) return cached.arrayBuffer();
  const response = await fetch(asset.url, { cache: 'no-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error('FACE_MODEL_DOWNLOAD');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== asset.byteSize || buffer.byteLength > asset.sizeBudgetBytes) throw new Error('FACE_MODEL_SIZE');
  if (await sha256Hex(buffer) !== asset.sha256) throw new Error('FACE_MODEL_SHA256');
  await cache?.put(asset.url, new Response(buffer.slice(0), {
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' },
  }));
  return buffer;
}

function canvasFor(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function imageTensorData(image: CanvasImageSource, width: number, height: number, normalize: boolean): Float32Array {
  const canvas = canvasFor(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const plane = width * height;
  const output = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    const offset = index * 4;
    const scale = normalize ? 1 / 128 : 1;
    const center = normalize ? 127.5 : 0;
    output[index] = ((pixels[offset + 2] ?? 0) - center) * scale;
    output[plane + index] = ((pixels[offset + 1] ?? 0) - center) * scale;
    output[2 * plane + index] = ((pixels[offset] ?? 0) - center) * scale;
  }
  return output;
}

function floatData(tensor: Tensor | undefined): Float32Array | null {
  return tensor?.data instanceof Float32Array ? tensor.data : null;
}

function overlap(left: DetectedFace, right: DetectedFace): number {
  const x1 = Math.max(left.box.x, right.box.x);
  const y1 = Math.max(left.box.y, right.box.y);
  const x2 = Math.min(left.box.x + left.box.width, right.box.x + right.box.width);
  const y2 = Math.min(left.box.y + left.box.height, right.box.y + right.box.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.box.width * left.box.height + right.box.width * right.box.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function nms(faces: DetectedFace[], threshold = 0.3): DetectedFace[] {
  const selected: DetectedFace[] = [];
  for (const face of [...faces].sort((left, right) => right.score - left.score)) {
    if (selected.every((candidate) => overlap(face, candidate) < threshold)) selected.push(face);
  }
  return selected;
}

interface YuNetHead {
  bbox: Float32Array;
  cls: Float32Array;
  kps: Float32Array;
  obj: Float32Array;
  stride: number;
}

/** Decode one raw YuNet feature-map head using OpenCV's FaceDetectorYN geometry. */
export function decodeYuNetHead(
  { bbox, cls, kps, obj, stride }: YuNetHead,
  sourceWidth: number,
  sourceHeight: number,
  scoreThreshold = 0.75,
): DetectedFace[] {
  const columns = Math.ceil(YUNET_INPUT_SIZE / stride);
  const rows = Math.ceil(YUNET_INPUT_SIZE / stride);
  const candidateCount = Math.min(rows * columns, cls.length, obj.length, Math.floor(bbox.length / 4), Math.floor(kps.length / 10));
  const scaleX = sourceWidth / YUNET_INPUT_SIZE;
  const scaleY = sourceHeight / YUNET_INPUT_SIZE;
  const found: DetectedFace[] = [];

  for (let index = 0; index < candidateCount; index += 1) {
    const classScore = Math.min(1, Math.max(0, cls[index] ?? 0));
    const objectScore = Math.min(1, Math.max(0, obj[index] ?? 0));
    const score = Math.sqrt(classScore * objectScore);
    if (score < scoreThreshold) continue;

    const row = Math.floor(index / columns);
    const column = index % columns;
    const bboxOffset = index * 4;
    const centerX = (column + (bbox[bboxOffset] ?? 0)) * stride;
    const centerY = (row + (bbox[bboxOffset + 1] ?? 0)) * stride;
    const boxWidth = Math.exp(bbox[bboxOffset + 2] ?? 0) * stride;
    const boxHeight = Math.exp(bbox[bboxOffset + 3] ?? 0) * stride;
    const left = Math.max(0, (centerX - boxWidth / 2) * scaleX);
    const top = Math.max(0, (centerY - boxHeight / 2) * scaleY);
    const right = Math.min(sourceWidth, (centerX + boxWidth / 2) * scaleX);
    const bottom = Math.min(sourceHeight, (centerY + boxHeight / 2) * scaleY);
    if (![left, top, right, bottom, score].every(Number.isFinite) || right <= left || bottom <= top) continue;

    const landmarks: FaceLandmark[] = [];
    for (let point = 0; point < 5; point += 1) {
      const landmarkOffset = index * 10 + point * 2;
      landmarks.push({
        x: (column + (kps[landmarkOffset] ?? 0)) * stride * scaleX,
        y: (row + (kps[landmarkOffset + 1] ?? 0)) * stride * scaleY,
      });
    }
    if (!landmarks.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) continue;

    found.push({
      score,
      box: { x: left, y: top, width: right - left, height: bottom - top },
      landmarks,
    });
  }

  return found;
}

function decodeYuNet(outputs: InferenceSession.OnnxValueMapType, sourceWidth: number, sourceHeight: number): DetectedFace[] {
  const found: DetectedFace[] = [];
  for (const stride of [8, 16, 32]) {
    const cls = floatData(outputs[`cls_${stride}`]);
    const obj = floatData(outputs[`obj_${stride}`]);
    const bbox = floatData(outputs[`bbox_${stride}`]);
    const kps = floatData(outputs[`kps_${stride}`]);
    if (!cls || !obj || !bbox || !kps) continue;
    found.push(...decodeYuNetHead({ bbox, cls, kps, obj, stride }, sourceWidth, sourceHeight));
  }
  return nms(found);
}

function solve3(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((row, index) => [...row, values[index] ?? 0]);
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(rows[row]?.[pivot] ?? 0) > Math.abs(rows[best]?.[pivot] ?? 0)) best = row;
    }
    [rows[pivot], rows[best]] = [rows[best] ?? [], rows[pivot] ?? []];
    const divisor = rows[pivot]?.[pivot] ?? 0;
    if (Math.abs(divisor) < 1e-8) throw new Error('FACE_ALIGNMENT_SINGULAR');
    for (let column = pivot; column < 4; column += 1) rows[pivot]![column] = (rows[pivot]?.[column] ?? 0) / divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = rows[row]?.[pivot] ?? 0;
      for (let column = pivot; column < 4; column += 1) {
        rows[row]![column] = (rows[row]?.[column] ?? 0) - factor * (rows[pivot]?.[column] ?? 0);
      }
    }
  }
  return [rows[0]?.[3] ?? 0, rows[1]?.[3] ?? 0, rows[2]?.[3] ?? 0];
}

function affineFromLandmarks(source: FaceLandmark[]): [number, number, number, number, number, number] {
  const target: FaceLandmark[] = [
    { x: 38.2946, y: 51.6963 }, { x: 73.5318, y: 51.5014 }, { x: 56.0252, y: 71.7366 },
    { x: 41.5493, y: 92.3655 }, { x: 70.7299, y: 92.2041 },
  ];
  if (source.length < 5) throw new Error('FACE_LANDMARKS_REQUIRED');
  let xx = 0; let xy = 0; let yy = 0; let x = 0; let y = 0;
  let txX = 0; let txY = 0; let tx = 0; let tyX = 0; let tyY = 0; let ty = 0;
  for (let index = 0; index < 5; index += 1) {
    const point = source[index]!; const destination = target[index]!;
    xx += point.x * point.x; xy += point.x * point.y; yy += point.y * point.y; x += point.x; y += point.y;
    txX += destination.x * point.x; txY += destination.x * point.y; tx += destination.x;
    tyX += destination.y * point.x; tyY += destination.y * point.y; ty += destination.y;
  }
  const normal = [[xx, xy, x], [xy, yy, y], [x, y, 5]];
  const [a, c, e] = solve3(normal, [txX, txY, tx]);
  const [b, d, f] = solve3(normal, [tyX, tyY, ty]);
  return [a ?? 0, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0];
}

function alignedFace(image: CanvasImageSource, face: DetectedFace): HTMLCanvasElement {
  const canvas = canvasFor(112, 112);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.setTransform(...affineFromLandmarks(face.landmarks));
  context.drawImage(image, 0, 0);
  context.resetTransform();
  return canvas;
}

export class FaceInference {
  private constructor(
    private readonly detector: InferenceSession,
    private readonly TensorConstructor: typeof Tensor,
    private readonly loadRecognizer: () => Promise<InferenceSession>,
  ) {}

  static async load(options: FaceInferenceOptions = {}): Promise<FaceInference> {
    const useWebGpu = canUseWebGpuRuntime(options.preferWebGpu === true, navigator, WebAssembly);
    const ort = useWebGpu
      ? await import('onnxruntime-web/jspi')
      : await import('onnxruntime-web/wasm');
    const executionProviders = useWebGpu ? ['webgpu', 'wasm'] : ['wasm'];
    const yunet = FACE_MODEL_MANIFEST.models[0];
    const sface = FACE_MODEL_MANIFEST.models[1];
    if (!yunet || !sface) throw new Error('FACE_MODEL_MANIFEST');

    // A single WASM thread works without cross-origin isolation and is the
    // most portable option for privacy-first, on-device processing. It also
    // avoids a browser-specific worker/SAB failure from blocking the gallery.
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';

    const yunetBytes = await verifiedModel(yunet);
    const detector = await ort.InferenceSession.create(yunetBytes, { executionProviders });
    let recognizer: Promise<InferenceSession> | null = null;
    const loadRecognizer = () => {
      recognizer ??= verifiedModel(sface)
        .then((sfaceBytes) => ort.InferenceSession.create(sfaceBytes, { executionProviders }));
      return recognizer;
    };
    return new FaceInference(detector, ort.Tensor, loadRecognizer);
  }

  async detect(image: ImageBitmap): Promise<DetectedFace[]> {
    const data = imageTensorData(image, YUNET_INPUT_SIZE, YUNET_INPUT_SIZE, false);
    const input = new this.TensorConstructor('float32', data, [1, 3, YUNET_INPUT_SIZE, YUNET_INPUT_SIZE]);
    const outputs = await this.detector.run({ [this.detector.inputNames[0] ?? 'input']: input });
    return decodeYuNet(outputs, image.width, image.height);
  }

  async embed(image: ImageBitmap, face: DetectedFace): Promise<number[]> {
    const crop = alignedFace(image, face);
    const data = imageTensorData(crop, 112, 112, true);
    const input = new this.TensorConstructor('float32', data, [1, 3, 112, 112]);
    const recognizer = await this.loadRecognizer();
    const outputs = await recognizer.run({ [recognizer.inputNames[0] ?? 'input']: input });
    const tensor = outputs[recognizer.outputNames[0] ?? 'output'];
    const values = floatData(tensor);
    if (!values) throw new Error('FACE_EMBEDDING_OUTPUT');
    return normalizeEmbedding(values);
  }
}
