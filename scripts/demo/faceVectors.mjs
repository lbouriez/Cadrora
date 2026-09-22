import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { InferenceSession, Tensor, env as ortEnv } from 'onnxruntime-web';
import sharp from 'sharp';

const YUNET_SIZE = 640;
const SCORE_THRESHOLD = 0.75;
const NMS_THRESHOLD = 0.3;
const MATCH_THRESHOLD = 0.363;

function tensorData(tensor) {
  if (!(tensor?.data instanceof Float32Array)) throw new Error('Unexpected face-model output.');
  return tensor.data;
}

function imageTensorData(pixels, width, height, channelOrder) {
  const plane = width * height;
  const output = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    const offset = index * 3;
    const red = pixels[offset] ?? 0;
    const green = pixels[offset + 1] ?? 0;
    const blue = pixels[offset + 2] ?? 0;
    output[index] = channelOrder === 'rgb' ? red : blue;
    output[plane + index] = green;
    output[2 * plane + index] = channelOrder === 'rgb' ? blue : red;
  }
  return output;
}

function overlap(left, right) {
  const x1 = Math.max(left.box.x, right.box.x);
  const y1 = Math.max(left.box.y, right.box.y);
  const x2 = Math.min(left.box.x + left.box.width, right.box.x + right.box.width);
  const y2 = Math.min(left.box.y + left.box.height, right.box.y + right.box.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.box.width * left.box.height + right.box.width * right.box.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function decodeYuNet(outputs, sourceWidth, sourceHeight) {
  const faces = [];
  for (const stride of [8, 16, 32]) {
    const cls = tensorData(outputs[`cls_${stride}`]);
    const obj = tensorData(outputs[`obj_${stride}`]);
    const bbox = tensorData(outputs[`bbox_${stride}`]);
    const kps = tensorData(outputs[`kps_${stride}`]);
    const columns = Math.ceil(YUNET_SIZE / stride);
    const rows = Math.ceil(YUNET_SIZE / stride);
    const count = Math.min(rows * columns, cls.length, obj.length, Math.floor(bbox.length / 4), Math.floor(kps.length / 10));
    const scaleX = sourceWidth / YUNET_SIZE;
    const scaleY = sourceHeight / YUNET_SIZE;
    for (let index = 0; index < count; index += 1) {
      const score = Math.sqrt(
        Math.min(1, Math.max(0, cls[index] ?? 0))
        * Math.min(1, Math.max(0, obj[index] ?? 0)),
      );
      if (score < SCORE_THRESHOLD) continue;
      const row = Math.floor(index / columns);
      const column = index % columns;
      const offset = index * 4;
      const centerX = (column + (bbox[offset] ?? 0)) * stride;
      const centerY = (row + (bbox[offset + 1] ?? 0)) * stride;
      const width = Math.exp(bbox[offset + 2] ?? 0) * stride;
      const height = Math.exp(bbox[offset + 3] ?? 0) * stride;
      const left = Math.max(0, (centerX - width / 2) * scaleX);
      const top = Math.max(0, (centerY - height / 2) * scaleY);
      const right = Math.min(sourceWidth, (centerX + width / 2) * scaleX);
      const bottom = Math.min(sourceHeight, (centerY + height / 2) * scaleY);
      if (![left, top, right, bottom, score].every(Number.isFinite) || right <= left || bottom <= top) continue;
      const landmarks = Array.from({ length: 5 }, (_, point) => ({
        x: (column + (kps[index * 10 + point * 2] ?? 0)) * stride * scaleX,
        y: (row + (kps[index * 10 + point * 2 + 1] ?? 0)) * stride * scaleY,
      }));
      faces.push({ box: { x: left, y: top, width: right - left, height: bottom - top }, landmarks, score });
    }
  }
  const selected = [];
  for (const face of faces.sort((left, right) => right.score - left.score)) {
    if (selected.every((candidate) => overlap(face, candidate) < NMS_THRESHOLD)) selected.push(face);
  }
  return selected.sort((left, right) => left.box.y - right.box.y || left.box.x - right.box.x);
}

function solve3(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index] ?? 0]);
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(rows[row]?.[pivot] ?? 0) > Math.abs(rows[best]?.[pivot] ?? 0)) best = row;
    }
    [rows[pivot], rows[best]] = [rows[best], rows[pivot]];
    const divisor = rows[pivot]?.[pivot] ?? 0;
    if (Math.abs(divisor) < 1e-8) throw new Error('Face alignment is singular.');
    for (let column = pivot; column < 4; column += 1) rows[pivot][column] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = rows[row]?.[pivot] ?? 0;
      for (let column = pivot; column < 4; column += 1) rows[row][column] -= factor * rows[pivot][column];
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]];
}

function affineFromLandmarks(source) {
  const target = [
    { x: 38.2946, y: 51.6963 }, { x: 73.5318, y: 51.5014 }, { x: 56.0252, y: 71.7366 },
    { x: 41.5493, y: 92.3655 }, { x: 70.7299, y: 92.2041 },
  ];
  let xx = 0; let xy = 0; let yy = 0; let x = 0; let y = 0;
  let txX = 0; let txY = 0; let tx = 0; let tyX = 0; let tyY = 0; let ty = 0;
  for (let index = 0; index < 5; index += 1) {
    const point = source[index]; const destination = target[index];
    xx += point.x * point.x; xy += point.x * point.y; yy += point.y * point.y; x += point.x; y += point.y;
    txX += destination.x * point.x; txY += destination.x * point.y; tx += destination.x;
    tyX += destination.y * point.x; tyY += destination.y * point.y; ty += destination.y;
  }
  const normal = [[xx, xy, x], [xy, yy, y], [x, y, 5]];
  const [a, c, e] = solve3(normal, [txX, txY, tx]);
  const [b, d, f] = solve3(normal, [tyX, tyY, ty]);
  return [a, b, c, d, e, f];
}

function alignedFacePixels(pixels, width, height, landmarks) {
  const [a, b, c, d, e, f] = affineFromLandmarks(landmarks);
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-8) throw new Error('Face alignment is singular.');
  const output = new Uint8Array(112 * 112 * 3);
  for (let destinationY = 0; destinationY < 112; destinationY += 1) {
    for (let destinationX = 0; destinationX < 112; destinationX += 1) {
      const translatedX = destinationX + 0.5 - e;
      const translatedY = destinationY + 0.5 - f;
      const sourceX = (d * translatedX - c * translatedY) / determinant - 0.5;
      const sourceY = (-b * translatedX + a * translatedY) / determinant - 0.5;
      const x0 = Math.floor(sourceX); const y0 = Math.floor(sourceY);
      const x1 = x0 + 1; const y1 = y0 + 1;
      const fx = sourceX - x0; const fy = sourceY - y0;
      const destinationOffset = (destinationY * 112 + destinationX) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const sample = (sampleX, sampleY) => (
          sampleX >= 0 && sampleY >= 0 && sampleX < width && sampleY < height
            ? pixels[(sampleY * width + sampleX) * 3 + channel] ?? 0
            : 0
        );
        const top = sample(x0, y0) * (1 - fx) + sample(x1, y0) * fx;
        const bottom = sample(x0, y1) * (1 - fx) + sample(x1, y1) * fx;
        output[destinationOffset + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return output;
}

function normalize(values) {
  const vector = Array.from(values, Number);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (vector.length !== 128 || !Number.isFinite(norm) || norm <= 0) throw new Error('Invalid SFace embedding.');
  return vector.map((value) => value / norm);
}

async function decodedImage(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`Expected RGB pixels for ${path}.`);
  return { pixels: data, width: info.width, height: info.height };
}

async function detectFaces(detector, path) {
  const source = await decodedImage(path);
  const { data } = await sharp(path).removeAlpha().resize(YUNET_SIZE, YUNET_SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const input = new Tensor('float32', imageTensorData(data, YUNET_SIZE, YUNET_SIZE, 'bgr'), [1, 3, YUNET_SIZE, YUNET_SIZE]);
  const outputs = await detector.run({ [detector.inputNames[0] ?? 'input']: input });
  return { ...source, faces: decodeYuNet(outputs, source.width, source.height) };
}

async function embedFace(recognizer, image, face) {
  const aligned = alignedFacePixels(image.pixels, image.width, image.height, face.landmarks);
  const input = new Tensor('float32', imageTensorData(aligned, 112, 112, 'rgb'), [1, 3, 112, 112]);
  const outputs = await recognizer.run({ [recognizer.inputNames[0] ?? 'input']: input });
  return normalize(tensorData(outputs[recognizer.outputNames[0] ?? 'output']));
}

function cosine(left, right) {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const negativeControlPhotoIds = new Set(
  Array.from({ length: 5 }, (_, index) => `demo-ai-${String(index + 11).padStart(2, '0')}`),
);

export async function buildDemoFaceIndex({ mediaDirectory, modelDirectory, portraitDirectory }) {
  ortEnv.wasm.numThreads = 1;
  ortEnv.logLevel = 'fatal';
  const sessionOptions = { logSeverityLevel: 4 };
  const detector = await InferenceSession.create(
    await readFile(join(modelDirectory, 'face_detection_yunet_2023mar.onnx')),
    sessionOptions,
  );
  const recognizer = await InferenceSession.create(
    await readFile(join(modelDirectory, 'face_recognition_sface_2021dec.onnx')),
    sessionOptions,
  );
  const namespace = 'face:demo-ai-face-search:generation:0';
  const partitionId = 'demo-ai-face-partition-0';
  const indexed = [];
  const photosWithoutFaces = [];

  for (let photoNumber = 1; photoNumber <= 15; photoNumber += 1) {
    const number = String(photoNumber).padStart(2, '0');
    const image = await detectFaces(detector, join(mediaDirectory, `ai-demo-${number}-large.webp`));
    if (image.faces.length === 0) {
      photosWithoutFaces.push(`demo-ai-${number}`);
      continue;
    }
    for (let faceNumber = 0; faceNumber < image.faces.length; faceNumber += 1) {
      const id = `demo-ai-${number}-face-${String(faceNumber + 1).padStart(2, '0')}`;
      indexed.push({
        faceId: id,
        faceNumber,
        photoId: `demo-ai-${number}`,
        values: await embedFace(recognizer, image, image.faces[faceNumber]),
        vectorId: `demo-ai-face-search:0:${id}`,
      });
    }
  }

  const missingNegativeControls = [...negativeControlPhotoIds].filter((photoId) => photosWithoutFaces.includes(photoId));
  if (missingNegativeControls.length > 0) {
    throw new Error(`Expected a detectable face in every negative-control photo: ${missingNegativeControls.join(', ')}.`);
  }

  const portraitMatches = {};
  const portraitEmbeddings = {};
  for (const name of ['amelia', 'daniel']) {
    const image = await detectFaces(detector, join(portraitDirectory, `test-portrait-${name}.webp`));
    if (image.faces.length !== 1) throw new Error(`Expected one face in ${name}'s demo portrait, found ${image.faces.length}.`);
    const embedding = await embedFace(recognizer, image, image.faces[0]);
    portraitEmbeddings[name] = embedding;
    const matches = indexed
      .map((candidate) => ({ photoId: candidate.photoId, score: cosine(embedding, candidate.values) }))
      .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
      .sort((left, right) => right.score - left.score);
    if (matches.length === 0) throw new Error(`${name}'s demo portrait has no match at the production threshold.`);
    const falsePositiveControls = matches.filter((candidate) => negativeControlPhotoIds.has(candidate.photoId));
    if (falsePositiveControls.length > 0) {
      throw new Error(`${name}'s portrait incorrectly matched negative-control photos: ${falsePositiveControls.map((candidate) => candidate.photoId).join(', ')}.`);
    }
    portraitMatches[name] = matches;
  }

  const vectors = indexed.map((face) => JSON.stringify({
    id: face.vectorId,
    namespace,
    values: face.values,
    metadata: { partition_id: partitionId },
  })).join('\n');
  const faceRows = indexed.map((face) => `  (${[
    face.faceId, 'demo-ai-face-search', face.photoId, face.faceNumber, partitionId,
    face.vectorId, 'sface-2021dec', null, '2026-09-21T00:00:00.000Z',
  ].map((value) => value === null ? 'NULL' : typeof value === 'number' ? String(value) : sqlString(value)).join(', ')})`).join(',\n');
  const sql = `PRAGMA foreign_keys = ON;
DELETE FROM faces WHERE event_id = 'demo-ai-face-search';
DELETE FROM face_partitions WHERE event_id = 'demo-ai-face-search';
INSERT INTO face_partitions (id, event_id, generation, partition_number, face_count, created_at)
VALUES ('${partitionId}', 'demo-ai-face-search', 0, 0, ${indexed.length}, '2026-09-21T00:00:00.000Z');
INSERT INTO faces (id, event_id, photo_id, face_number, partition_id, vector_id, model_id, expires_at, created_at)
VALUES
${faceRows};
`;
  return {
    faceCount: indexed.length,
    negativeControlCount: negativeControlPhotoIds.size,
    photosWithoutFaces,
    portraitEmbeddings,
    portraitMatches,
    sql,
    vectors: `${vectors}\n`,
  };
}
