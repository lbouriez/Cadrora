import { IMPORT_CHUNK_SIZE } from '../../shared/constants';
import {
  ImageProcessingError,
  createImageEncoder,
  type ImageEncoder,
  type ValidatedImageFile,
  validateImageFile,
} from '../images';
import { ConcurrencyLimiter, mapWithConcurrency } from './concurrency';
import { declarationFromJournal, type ImportApi } from './ImportApi';
import type {
  ImportJournal,
  ImportJournalChunk,
  ImportJournalJob,
  ImportJournalPhoto,
  JournalFile,
} from './ImportJournal';

export type ImportPipelineState = 'cancelled' | 'completed' | 'idle' | 'paused' | 'preparing' | 'processing' | 'failed';

export interface ImportPipelineSnapshot {
  completedPhotos: number;
  currentChunk?: number;
  etaSeconds?: number;
  failedPhotos: number;
  importId?: string;
  state: ImportPipelineState;
  totalPhotos: number;
}

export interface RejectedImportFile {
  code: 'CORRUPT_IMAGE' | 'UNSUPPORTED_IMAGE';
  file: File;
}

export interface ImportStartResult {
  importId?: string;
  rejected: RejectedImportFile[];
}

export interface ImportPipelineOptions {
  api: ImportApi;
  createEncoder?: () => ImageEncoder;
  journal: ImportJournal;
  now?: () => Date;
  onChange?: (snapshot: ImportPipelineSnapshot) => void;
}

class ImportCancelledError extends Error {
  constructor() {
    super('Import cancelled.');
  }
}

/**
 * Browser-only resumable import orchestrator. Declarations are durable chunks
 * of at most 50, image work is capped at two encodes, and all variants share
 * one three-request upload limiter.
 */
export class ImportPipeline {
  private abortController: AbortController | undefined;
  private activeImportId: string | undefined;
  private checkpointResolver: (() => void) | undefined;
  private currentChunk: number | undefined;
  private readonly createEncoder: () => ImageEncoder;
  private completedPhotos = 0;
  private failedPhotos = 0;
  private startedAt = 0;
  private state: ImportPipelineState = 'idle';
  private totalPhotos = 0;
  private readonly now: () => Date;
  private readonly listeners = new Set<(snapshot: ImportPipelineSnapshot) => void>();

  constructor(private readonly options: ImportPipelineOptions) {
    this.createEncoder = options.createEncoder ?? createImageEncoder;
    this.now = options.now ?? (() => new Date());
    if (options.onChange) this.listeners.add(options.onChange);
  }

  subscribe(listener: (snapshot: ImportPipelineSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async start(eventId: string, files: File[], timeZone = 'UTC'): Promise<ImportStartResult> {
    if (this.state === 'preparing' || this.state === 'processing' || this.state === 'paused') {
      throw new Error('An import is already active.');
    }
    this.state = 'preparing';
    this.emit();

    const prepared = await this.preflight(files, timeZone);
    if (prepared.accepted.length === 0) {
      this.state = 'idle';
      this.emit();
      return { rejected: prepared.rejected };
    }

    const importId = crypto.randomUUID();
    const now = this.now().toISOString();
    const job: ImportJournalJob = {
      createdAt: now,
      eventId,
      id: importId,
      state: 'processing',
      totalPhotos: prepared.accepted.length,
      updatedAt: now,
    };
    const chunks = buildChunks(importId, prepared.accepted, now);
    const journalFiles: JournalFile[] = prepared.accepted.map(({ file, sourceIndex }) => ({ file, importId, sourceIndex }));
    await this.options.journal.create({ chunks, files: journalFiles, job });

    this.activeImportId = importId;
    this.completedPhotos = 0;
    this.failedPhotos = 0;
    this.totalPhotos = job.totalPhotos;
    this.state = 'processing';
    this.startedAt = Date.now();
    this.emit();

    try {
      // The client-provided id makes a retry after a tab crash naturally idempotent.
      await this.options.api.createImport(eventId, { id: importId, totalPhotos: job.totalPhotos });
      await this.process(importId);
    } catch (error) {
      await this.handleRunError(importId, error);
      throw error;
    }
    return { importId, rejected: prepared.rejected };
  }

  async resume(importId: string): Promise<void> {
    if (this.activeImportId === importId && this.state === 'paused') {
      this.state = 'processing';
      this.checkpointResolver?.();
      this.checkpointResolver = undefined;
      this.emit();
      return;
    }
    if (this.state === 'preparing' || this.state === 'processing') throw new Error('An import is already active.');
    const job = await this.options.journal.getJob(importId);
    if (!job || job.state === 'cancelled' || job.state === 'completed') throw new Error('No resumable import was found.');

    this.activeImportId = importId;
    const chunks = await this.options.journal.getChunks(importId);
    this.completedPhotos = chunks.flatMap((chunk) => chunk.photos).filter((photo) => photo.state === 'finalized').length;
    this.failedPhotos = chunks.flatMap((chunk) => chunk.photos).filter((photo) => photo.state === 'failed').length;
    this.totalPhotos = job.totalPhotos;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.currentChunk = undefined;
    this.startedAt = Date.now();
    this.state = 'processing';
    await this.saveJobState(job, 'processing');
    this.emit();
    try {
      await this.options.api.createImport(job.eventId, { id: job.id, totalPhotos: job.totalPhotos });
      await this.process(importId);
    } catch (error) {
      await this.handleRunError(importId, error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.state !== 'processing' || !this.activeImportId) return;
    this.state = 'paused';
    const job = await this.requireJob(this.activeImportId);
    await this.saveJobState(job, 'paused');
    this.emit();
  }

  async cancel(): Promise<void> {
    if (!this.activeImportId || (this.state !== 'processing' && this.state !== 'paused')) return;
    this.abortController?.abort();
    this.checkpointResolver?.();
    this.checkpointResolver = undefined;
    this.state = 'cancelled';
    const job = await this.requireJob(this.activeImportId);
    await this.saveJobState(job, 'cancelled');
    this.emit();
  }

  private async preflight(files: File[], timeZone: string): Promise<{
    accepted: (ValidatedImageFile & { sourceIndex: number })[];
    rejected: RejectedImportFile[];
  }> {
    const results = await mapWithConcurrency(files, 2, async (file, sourceIndex) => {
      try {
        return { sourceIndex, validated: await validateImageFile(file, timeZone) } as const;
      } catch (error) {
        if (error instanceof ImageProcessingError && (error.code === 'CORRUPT_IMAGE' || error.code === 'UNSUPPORTED_IMAGE')) {
          return { error, file, sourceIndex } as const;
        }
        throw error;
      }
    });

    const accepted: (ValidatedImageFile & { sourceIndex: number })[] = [];
    const rejected: RejectedImportFile[] = [];
    for (const result of results) {
      if ('validated' in result) accepted.push({ ...result.validated, sourceIndex: result.sourceIndex });
      else {
        rejected.push({
          code: result.error.code === 'CORRUPT_IMAGE' ? 'CORRUPT_IMAGE' : 'UNSUPPORTED_IMAGE',
          file: result.file,
        });
      }
    }
    return { accepted, rejected };
  }

  private async process(importId: string): Promise<void> {
    const abortController = new AbortController();
    this.abortController = abortController;
    const encoder = this.createEncoder();
    const uploadLimiter = new ConcurrencyLimiter(3);
    try {
      for (;;) {
        await this.waitForCheckpoint();
        const chunk = await this.options.journal.getNextUnfinishedChunk(importId);
        if (!chunk) break;
        this.currentChunk = chunk.number;
        chunk.state = 'uploading';
        chunk.updatedAt = this.now().toISOString();
        await this.options.journal.saveChunk(chunk);
        this.emit();

        await this.options.api.declarePhotos(
          importId,
          { chunkNumber: chunk.number, photos: chunk.photos.map(declarationFromJournal) },
          abortController.signal,
        );
        const files = await this.options.journal.getFiles(
          importId,
          chunk.photos.map((photo) => photo.sourceIndex),
        );
        const errors = await this.processChunk(chunk, files, encoder, uploadLimiter, abortController.signal);
        if (errors > 0) {
          chunk.state = 'failed';
          chunk.updatedAt = this.now().toISOString();
          await this.options.journal.saveChunk(chunk);
          this.state = 'paused';
          const job = await this.requireJob(importId);
          await this.saveJobState(job, 'paused');
          this.emit();
          return;
        }

        chunk.state = 'finalized';
        chunk.updatedAt = this.now().toISOString();
        await this.options.journal.saveChunk(chunk);
        this.emit();
      }

      this.state = 'completed';
      const job = await this.requireJob(importId);
      await this.saveJobState(job, 'completed');
      this.emit();
    } finally {
      encoder.dispose();
      this.currentChunk = undefined;
    }
  }

  private async processChunk(
    chunk: ImportJournalChunk,
    files: Map<number, File>,
    encoder: ImageEncoder,
    uploadLimiter: ConcurrencyLimiter,
    signal: AbortSignal,
  ): Promise<number> {
    const candidates = chunk.photos.filter((photo) => photo.state !== 'finalized');
    const results = await mapWithConcurrency(candidates, 2, async (photo) => {
      try {
        await this.waitForCheckpoint();
        const file = files.get(photo.sourceIndex);
        if (!file) throw new ImageProcessingError('CORRUPT_IMAGE', 'The source file is no longer available for resume.');
        const encoded = await encoder.encode(file);
        await Promise.all(
          encoded.variants.map((variant) =>
            uploadLimiter.run(() => this.options.api.uploadVariant(photo.id, variant, signal)),
          ),
        );
        await this.options.api.finalizePhoto(photo.id, signal);
        if (photo.state === 'failed') this.failedPhotos = Math.max(0, this.failedPhotos - 1);
        photo.state = 'finalized';
        this.completedPhotos += 1;
        this.emit();
        return true;
      } catch (error) {
        if (error instanceof ImportCancelledError || this.abortController?.signal.aborted) throw new ImportCancelledError();
        photo.errorCode = error instanceof ImageProcessingError ? error.code : 'UPLOAD_FAILED';
        photo.state = 'failed';
        this.failedPhotos += 1;
        this.emit();
        return false;
      }
    });
    return results.filter((result) => !result).length;
  }

  private async waitForCheckpoint(): Promise<void> {
    if (this.isCancelled()) throw new ImportCancelledError();
    if (this.state !== 'paused') return;
    await new Promise<void>((resolve) => {
      this.checkpointResolver = resolve;
    });
    if (this.isCancelled()) throw new ImportCancelledError();
  }

  private async handleRunError(importId: string, error: unknown): Promise<void> {
    if (error instanceof ImportCancelledError || this.state === 'cancelled') {
      this.state = 'cancelled';
      this.emit();
      return;
    }
    this.state = 'failed';
    const job = await this.options.journal.getJob(importId);
    if (job) await this.saveJobState(job, 'paused');
    this.emit();
  }

  private isCancelled(): boolean {
    return this.abortController?.signal.aborted === true || this.state === 'cancelled';
  }

  private async requireJob(importId: string): Promise<ImportJournalJob> {
    const job = await this.options.journal.getJob(importId);
    if (!job) throw new Error('Import journal is missing.');
    return job;
  }

  private async saveJobState(job: ImportJournalJob, state: ImportJournalJob['state']): Promise<void> {
    await this.options.journal.saveJob({ ...job, state, updatedAt: this.now().toISOString() });
  }

  private snapshot(): ImportPipelineSnapshot {
    // The durable journal is updated after each chunk; local counts make the UI responsive inside a chunk.
    const elapsedSeconds = this.startedAt ? (Date.now() - this.startedAt) / 1_000 : 0;
    const totalPhotos = this.totalPhotos;
    const processedPhotos = this.completedPhotos + this.failedPhotos;
    const etaSeconds =
      elapsedSeconds > 0 && processedPhotos > 0 && processedPhotos < totalPhotos
        ? Math.max(0, Math.round((elapsedSeconds / processedPhotos) * (totalPhotos - processedPhotos)))
        : undefined;
    return {
      ...(this.currentChunk === undefined ? {} : { currentChunk: this.currentChunk }),
      ...(this.activeImportId === undefined ? {} : { importId: this.activeImportId }),
      completedPhotos: this.completedPhotos,
      ...(etaSeconds === undefined ? {} : { etaSeconds }),
      failedPhotos: this.failedPhotos,
      state: this.state,
      totalPhotos,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function buildChunks(
  importId: string,
  files: (ValidatedImageFile & { sourceIndex: number })[],
  now: string,
): ImportJournalChunk[] {
  const chunks: ImportJournalChunk[] = [];
  for (let start = 0; start < files.length; start += IMPORT_CHUNK_SIZE) {
    const photos: ImportJournalPhoto[] = files.slice(start, start + IMPORT_CHUNK_SIZE).map((file) => ({
      ...(file.capturedAt ? { capturedAt: file.capturedAt } : {}),
      contentType: file.contentType,
      filename: file.file.name || `photo-${file.sourceIndex + 1}`,
      height: file.height,
      id: crypto.randomUUID(),
      sourceIndex: file.sourceIndex,
      sortKey: String(file.sourceIndex).padStart(8, '0'),
      state: 'pending',
      width: file.width,
    }));
    chunks.push({
      importId,
      number: chunks.length,
      photos,
      state: 'pending',
      updatedAt: now,
    });
  }
  return chunks;
}
