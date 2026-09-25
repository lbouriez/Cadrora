import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

import type { EncodedVariant, ImageEncoder } from '../../../src/browser/images';
import { ImportRequestError, type ImportApi } from '../../../src/browser/jobs/ImportApi';
import type {
  ImportJournal,
  ImportJournalChunk,
  ImportJournalJob,
  NewImportJournal,
} from '../../../src/browser/jobs/ImportJournal';
import { ImportPipeline, type ImportPipelineSnapshot } from '../../../src/browser/jobs/ImportPipeline';
import type { Import, ImportCreateRequest, ImportDeclarePhotosRequest } from '../../../src/shared/schemas';

const TIMESTAMP = '2026-09-20T16:00:00.000Z';

class MemoryImportJournal implements ImportJournal {
  readonly chunks = new Map<number, ImportJournalChunk>();
  readonly files = new Map<number, File>();
  job: ImportJournalJob | undefined;

  create(value: NewImportJournal): Promise<void> {
    this.job = value.job;
    for (const chunk of value.chunks) this.chunks.set(chunk.number, chunk);
    for (const record of value.files) this.files.set(record.sourceIndex, record.file);
    return Promise.resolve();
  }

  getChunks(importId: string): Promise<ImportJournalChunk[]> {
    return Promise.resolve([...this.chunks.values()]
      .filter((chunk) => chunk.importId === importId)
      .sort((left, right) => left.number - right.number));
  }

  getFiles(_importId: string, sourceIndexes: number[]): Promise<Map<number, File>> {
    return Promise.resolve(new Map(
      sourceIndexes.flatMap((sourceIndex) => {
        const file = this.files.get(sourceIndex);
        return file ? ([[sourceIndex, file]] satisfies [number, File][]) : [];
      }),
    ));
  }

  getJob(importId: string): Promise<ImportJournalJob | undefined> {
    return Promise.resolve(this.job?.id === importId ? this.job : undefined);
  }

  async getNextUnfinishedChunk(importId: string): Promise<ImportJournalChunk | undefined> {
    return (await this.getChunks(importId)).find((chunk) => chunk.state !== 'finalized');
  }

  getResumable(eventId: string): Promise<ImportJournalJob | undefined> {
    return Promise.resolve(this.job?.eventId === eventId && (this.job.state === 'paused' || this.job.state === 'processing')
      ? this.job
      : undefined);
  }

  saveChunk(chunk: ImportJournalChunk): Promise<void> {
    this.chunks.set(chunk.number, chunk);
    return Promise.resolve();
  }

  saveJob(job: ImportJournalJob): Promise<void> {
    this.job = job;
    return Promise.resolve();
  }
}

class RecordingImportApi implements ImportApi {
  readonly declared: ImportDeclarePhotosRequest[] = [];
  readonly created: ImportCreateRequest[] = [];
  readonly uploaded: EncodedVariant[] = [];

  constructor(private readonly failChunk?: number) {}

  checkDuplicates(eventId: string, hashes: string[]): Promise<string[]> {
    void eventId;
    void hashes;
    return Promise.resolve([]);
  }

  cancelImport(): Promise<void> { return Promise.resolve(); }

  createImport(eventId: string, request: ImportCreateRequest): Promise<Import> {
    this.created.push(request);
    return Promise.resolve({
      completedPhotos: 0,
      createdAt: TIMESTAMP,
      eventId,
      id: request.id,
      state: 'processing',
      totalPhotos: request.totalPhotos,
      updatedAt: TIMESTAMP,
    });
  }

  declarePhotos(_importId: string, request: ImportDeclarePhotosRequest): Promise<string[]> {
    this.declared.push(request);
    if (request.chunkNumber === this.failChunk) return Promise.reject(new Error('simulated tab or network interruption'));
    return Promise.resolve(request.photos.map((photo) => photo.id));
  }

  async finalizePhoto(): Promise<void> {}

  uploadVariant(_photoId: string, variant: EncodedVariant): Promise<void> { this.uploaded.push(variant); return Promise.resolve(); }
}

function makeFiles(count: number): File[] {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return Array.from({ length: count }, (_, index) => new File([jpeg, new Uint8Array([index & 255, index >> 8])], `photo-${index + 1}.jpg`, { type: 'image/jpeg' }));
}

function jpegWithOrientation(orientation: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
  bytes.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], 12);
  bytes.set([0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00], 20);
  bytes.set([0x00, 0x00, 0x00, 0x00, 0xff, 0xd9], 34);
  return bytes;
}

function createEncoder(encodedFiles: string[]): ImageEncoder {
  return {
    dispose: vi.fn(),
    encode: (file) => {
      encodedFiles.push(file.name);
      const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
      return Promise.resolve({
        height: 800,
        sourceContentType: 'image/jpeg',
        variants: [
          {
            blob,
            byteSize: blob.size,
            checksumSha256: '0'.repeat(64),
            contentType: 'image/jpeg',
            height: 480,
            name: 'thumb',
            width: 640,
          },
        ],
        width: 1_200,
      });
    },
  };
}

describe('ImportPipeline chunk journal and resume', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ close: vi.fn(), height: 800, width: 1_200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips identical files within one selection and hashes only future imports', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const files = makeFiles(2);
    const renamedCopy = new File([await files[0]!.arrayBuffer()], 'renamed.jpg', { type: 'image/jpeg' });
    const encodedFiles: string[] = [];
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder(encodedFiles), journal });

    const result = await pipeline.start('event-1', [files[0]!, renamedCopy, files[1]!]);

    expect(result.rejected).toMatchObject([{ code: 'DUPLICATE_IMAGE', file: renamedCopy }]);
    expect(api.created[0]?.totalPhotos).toBe(2);
    expect(api.declared[0]?.photos).toHaveLength(2);
    expect(api.declared[0]?.photos[0]?.sourceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(encodedFiles).toEqual([files[0]!.name, files[1]!.name]);
  });

  it('skips matching hashes already recorded in the same gallery before opening an import', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    vi.spyOn(api, 'checkDuplicates').mockImplementation((_eventId, hashes) => Promise.resolve(hashes.slice(0, 1)));
    const files = makeFiles(2);
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });

    const result = await pipeline.start('event-1', files);

    expect(result.rejected).toMatchObject([{ code: 'DUPLICATE_IMAGE', file: files[0] }]);
    expect(api.created[0]?.totalPhotos).toBe(1);
    expect(api.declared[0]?.photos).toMatchObject([{ filename: files[1]!.name }]);
  });

  it('does not create an import when every selected file is already present', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    vi.spyOn(api, 'checkDuplicates').mockImplementation((_eventId, hashes) => Promise.resolve(hashes));
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });

    const result = await pipeline.start('event-1', makeFiles(2));

    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.every((item) => item.code === 'DUPLICATE_IMAGE')).toBe(true);
    expect(api.created).toHaveLength(0);
    expect(journal.job).toBeUndefined();
  });

  it('declares a 200-photo journal as exactly four ordered chunks of 50', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const encodedFiles: string[] = [];
    const snapshots: ImportPipelineSnapshot[] = [];
    const pipeline = new ImportPipeline({
      api,
      createEncoder: () => createEncoder(encodedFiles),
      journal,
      now: () => new Date(TIMESTAMP),
      onChange: (snapshot) => snapshots.push(snapshot),
    });

    await pipeline.start('event-200', makeFiles(200));

    expect(api.declared.map(({ chunkNumber, photos }) => ({ chunkNumber, size: photos.length }))).toEqual([
      { chunkNumber: 0, size: 50 },
      { chunkNumber: 1, size: 50 },
      { chunkNumber: 2, size: 50 },
      { chunkNumber: 3, size: 50 },
    ]);
    expect([...journal.chunks.values()].map((chunk) => chunk.photos.length)).toEqual([50, 50, 50, 50]);
    expect([...journal.chunks.values()].every((chunk) => chunk.state === 'finalized')).toBe(true);
    expect(encodedFiles).toHaveLength(200);
    expect(journal.job).toMatchObject({ state: 'completed', totalPhotos: 200 });
    expect(snapshots.at(-1)).toMatchObject({ completedPhotos: 200, failedPhotos: 0, state: 'completed', totalPhotos: 200 });
  });

  it('carries a real EXIF capture instant into the declared photo', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const bytes = await readFile('tests/fixtures/nearby-amelia-exif.jpg');
    const photo = new File([bytes], 'nearby-amelia-exif.jpg', { type: 'image/jpeg' });
    const pipeline = new ImportPipeline({
      api,
      createEncoder: () => createEncoder([]),
      journal,
      now: () => new Date(TIMESTAMP),
    });

    await pipeline.start('demo-ai-face-search', [photo], 'America/Toronto');

    expect(api.declared[0]?.photos[0]).toMatchObject({
      capturedAt: '2026-08-30T18:02:00.000Z',
      filename: 'nearby-amelia-exif.jpg',
    });
  });

  it('uploads the exact source bytes when originals were selected for the import', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const file = makeFiles(1)[0]!;
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });
    await pipeline.start('event-1', [file], 'UTC', true);

    expect(api.created[0]).toMatchObject({ keepOriginals: true });
    expect(journal.job?.keepOriginals).toBe(true);
    const original = api.uploaded.find((variant) => variant.name === 'original');
    expect(original?.byteSize).toBe(file.size);
    expect(original?.contentType).toBe('image/jpeg');
    expect(new Uint8Array(await original!.blob.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));
    expect(original?.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('records the camera dimensions for an unmodified EXIF-rotated original', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const file = new File([jpegWithOrientation(6).buffer as ArrayBuffer], 'rotated.jpg', { type: 'image/jpeg' });
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });
    await pipeline.start('event-rotated', [file], 'UTC', true);

    expect(api.declared[0]?.photos[0]).toMatchObject({ width: 800, height: 1_200 });
    expect(api.uploaded.find((variant) => variant.name === 'original')).toMatchObject({ width: 1_200, height: 800 });
  });

  it('resumes a 200-photo journal at the first unfinished 50-photo chunk after interruption', async () => {
    const journal = new MemoryImportJournal();
    const firstApi = new RecordingImportApi(2);
    const firstEncodedFiles: string[] = [];
    const interrupted = new ImportPipeline({
      api: firstApi,
      createEncoder: () => createEncoder(firstEncodedFiles),
      journal,
      now: () => new Date(TIMESTAMP),
    });

    await expect(interrupted.start('event-resume-200', makeFiles(200))).rejects.toThrow('simulated tab or network interruption');
    const importId = journal.job?.id;
    expect(importId).toBeDefined();
    expect(firstApi.declared.map((request) => request.chunkNumber)).toEqual([0, 1, 2]);
    expect(firstEncodedFiles).toHaveLength(100);
    expect([...journal.chunks.values()].map((chunk) => chunk.state)).toEqual([
      'finalized',
      'finalized',
      'uploading',
      'pending',
    ]);
    expect(journal.job?.state).toBe('paused');

    const resumeApi = new RecordingImportApi();
    const resumedEncodedFiles: string[] = [];
    const resumedSnapshots: ImportPipelineSnapshot[] = [];
    const resumed = new ImportPipeline({
      api: resumeApi,
      createEncoder: () => createEncoder(resumedEncodedFiles),
      journal,
      now: () => new Date(TIMESTAMP),
      onChange: (snapshot) => resumedSnapshots.push(snapshot),
    });
    await resumed.resume(importId!);

    expect(resumeApi.declared.map(({ chunkNumber, photos }) => ({ chunkNumber, size: photos.length }))).toEqual([
      { chunkNumber: 2, size: 50 },
      { chunkNumber: 3, size: 50 },
    ]);
    expect(resumedEncodedFiles).toHaveLength(100);
    expect(journal.job).toMatchObject({ id: importId, state: 'completed', totalPhotos: 200 });
    expect(resumedSnapshots).toContainEqual(expect.objectContaining({ completedPhotos: 100, state: 'processing', totalPhotos: 200 }));
    expect(resumedSnapshots.at(-1)).toMatchObject({ completedPhotos: 200, failedPhotos: 0, state: 'completed' });
  });

  it('retries a 119-photo import refused before the server created it', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const create = vi.spyOn(api, 'createImport');
    create.mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'));
    const snapshots: ImportPipelineSnapshot[] = [];
    const pipeline = new ImportPipeline({
      api, createEncoder: () => createEncoder([]), journal,
      onChange: (snapshot) => snapshots.push(snapshot),
    });

    await expect(pipeline.start('event-119', makeFiles(119))).rejects.toThrow('Try again.');
    expect(snapshots.at(-1)).toMatchObject({ completedPhotos: 0, state: 'failed', totalPhotos: 119 });
    expect(journal.job).toMatchObject({ state: 'paused', totalPhotos: 119 });

    await pipeline.resume(journal.job!.id);
    expect(create).toHaveBeenCalledTimes(2);
    expect(api.declared.map(({ photos }) => photos.length)).toEqual([50, 50, 19]);
    expect(journal.job?.state).toBe('completed');
  });

  it('restarts the same pipeline after a failed variant without reloading the page', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    const upload = vi.spyOn(api, 'uploadVariant').mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'));
    const snapshots: ImportPipelineSnapshot[] = [];
    const pipeline = new ImportPipeline({
      api, createEncoder: () => createEncoder([]), journal,
      onChange: (snapshot) => snapshots.push(snapshot),
    });

    const result = await pipeline.start('event-1', makeFiles(1));
    expect(snapshots.at(-1)).toMatchObject({ completedPhotos: 0, failedPhotos: 1, state: 'paused' });
    expect(journal.job?.state).toBe('paused');

    await pipeline.resume(result.importId!);

    expect(api.created).toHaveLength(2);
    expect(api.declared).toHaveLength(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(journal.job?.state).toBe('completed');
    expect(snapshots.at(-1)).toMatchObject({ completedPhotos: 1, failedPhotos: 0, state: 'completed' });
  });

  it('counts one failed photo only once across repeated resume attempts', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    vi.spyOn(api, 'uploadVariant')
      .mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'))
      .mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'));
    const snapshots: ImportPipelineSnapshot[] = [];
    const pipeline = new ImportPipeline({
      api, createEncoder: () => createEncoder([]), journal,
      onChange: (snapshot) => snapshots.push(snapshot),
    });

    const result = await pipeline.start('event-1', makeFiles(1));
    await pipeline.resume(result.importId!);
    expect(snapshots.at(-1)).toMatchObject({ failedPhotos: 1, state: 'paused' });

    await pipeline.resume(result.importId!);
    expect(snapshots.at(-1)).toMatchObject({ completedPhotos: 1, failedPhotos: 0, state: 'completed' });
  });

  it('cancels a failed local journal when the server import does not exist', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    vi.spyOn(api, 'createImport').mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'));
    vi.spyOn(api, 'cancelImport').mockRejectedValueOnce(new ImportRequestError(404, 'IMPORT_NOT_FOUND', 'Missing.'));
    const pipeline = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });

    await expect(pipeline.start('event-1', makeFiles(1))).rejects.toThrow('Try again.');
    await pipeline.cancel();
    expect(journal.job?.state).toBe('cancelled');
  });

  it('cancels a paused browser journal after reconnecting before it exists on the server', async () => {
    const journal = new MemoryImportJournal();
    const api = new RecordingImportApi();
    vi.spyOn(api, 'createImport').mockRejectedValueOnce(new ImportRequestError(503, 'SERVICE_UNAVAILABLE', 'Try again.'));
    vi.spyOn(api, 'cancelImport').mockRejectedValueOnce(new ImportRequestError(404, 'IMPORT_NOT_FOUND', 'Missing.'));
    const first = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });
    await expect(first.start('event-1', makeFiles(1))).rejects.toThrow('Try again.');

    const reconnected = new ImportPipeline({ api, createEncoder: () => createEncoder([]), journal });
    const savedJob = (await journal.getResumable('event-1'))!;
    const getJob = vi.spyOn(journal, 'getJob').mockRejectedValueOnce(new Error('Second read unavailable'));
    await reconnected.cancel(savedJob);
    expect(getJob).not.toHaveBeenCalled();
    expect(journal.job?.state).toBe('cancelled');
    await expect(journal.getResumable('event-1')).resolves.toBeUndefined();
  });
});
