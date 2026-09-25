import { IMPORT_CHUNK_SIZE } from '../../shared/constants';
import {
  ImageProcessingError,
  createImageEncoder,
  type ImageEncoder,
  type ValidatedImageFile,
  validateImageFile,
} from '../images';
import { ConcurrencyLimiter, mapWithConcurrency } from './concurrency';
import { declarationFromJournal, ImportRequestError, type ImportApi } from './ImportApi';
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
  code: 'CORRUPT_IMAGE' | 'DUPLICATE_IMAGE' | 'ORIGINAL_TOO_LARGE' | 'UNSUPPORTED_IMAGE';
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

  async start(eventId: string, files: File[], timeZone = 'UTC', keepOriginals = false, replacementPhotoId?: string): Promise<ImportStartResult> {
    if (this.state === 'preparing' || this.state === 'processing' || this.state === 'paused') {
      throw new Error('An import is already active.');
    }
    this.state = 'preparing';
    this.emit();

    let prepared: Awaited<ReturnType<ImportPipeline['preflight']>>;
    try {
      prepared = await this.preflight(files, timeZone, keepOriginals);
      if (!replacementPhotoId && prepared.accepted.length > 0) {
        const seen = new Set<string>();
        const unique: typeof prepared.accepted = [];
        for (const candidate of prepared.accepted) {
          if (seen.has(candidate.sourceSha256)) prepared.rejected.push({ code: 'DUPLICATE_IMAGE', file: candidate.file });
          else {
            seen.add(candidate.sourceSha256);
            unique.push(candidate);
          }
        }
        const existing = new Set<string>();
        for (let index = 0; index < unique.length; index += IMPORT_CHUNK_SIZE) {
          const hashes = unique.slice(index, index + IMPORT_CHUNK_SIZE).map((candidate) => candidate.sourceSha256);
          for (const hash of await this.options.api.checkDuplicates(eventId, hashes)) existing.add(hash);
        }
        prepared.accepted = unique.filter((candidate) => {
          if (!existing.has(candidate.sourceSha256)) return true;
          prepared.rejected.push({ code: 'DUPLICATE_IMAGE', file: candidate.file });
          return false;
        });
      }
    } catch (error) {
      this.state = 'idle';
      this.emit();
      throw error;
    }
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
      keepOriginals,
      ...(replacementPhotoId ? { replacementPhotoId } : {}),
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
      await this.options.api.createImport(eventId, { id: importId, totalPhotos: job.totalPhotos, keepOriginals, ...(replacementPhotoId ? { replacementPhotoId } : {}) });
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
      await this.options.api.createImport(job.eventId, { id: job.id, totalPhotos: job.totalPhotos, keepOriginals: job.keepOriginals === true, ...(job.replacementPhotoId ? { replacementPhotoId: job.replacementPhotoId } : {}) });
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

  async cancel(resumableJob?: ImportJournalJob): Promise<void> {
    if (resumableJob) this.activeImportId = resumableJob.id;
    if (!this.activeImportId || (this.state !== 'processing' && this.state !== 'paused' && this.state !== 'failed' && !resumableJob)) return;
    this.abortController?.abort();
    this.checkpointResolver?.();
    this.checkpointResolver = undefined;
    // The import page already read this durable job when it offered Resume/Cancel.
    // Reuse the selected record instead of requiring a second IndexedDB read.
    const job = resumableJob ?? await this.requireJob(this.activeImportId);
    try {
      await this.options.api.cancelImport(job.id);
    } catch (error) {
      // A failed preflight can leave only a local journal, with no server import to cancel.
      if (!(error instanceof ImportRequestError && error.code === 'IMPORT_NOT_FOUND')) throw error;
    }
    this.state = 'cancelled';
    await this.saveJobState(job, 'cancelled');
    this.totalPhotos = job.totalPhotos;
    this.emit();
  }

  private async preflight(files: File[], timeZone: string, keepOriginals: boolean): Promise<{
    accepted: (ValidatedImageFile & { sourceIndex: number; sourceSha256: string })[];
    rejected: RejectedImportFile[];
  }> {
    const results = await mapWithConcurrency(files, 2, async (file, sourceIndex) => {
      try {
        if (keepOriginals && file.size > 100 * 1024 * 1024) {
          return { error: { code: 'ORIGINAL_TOO_LARGE' as const }, file, sourceIndex } as const;
        }
        const validated = await validateImageFile(file, timeZone);
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const sourceSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        return { sourceIndex, validated, sourceSha256 } as const;
      } catch (error) {
        if (error instanceof ImageProcessingError && (error.code === 'CORRUPT_IMAGE' || error.code === 'UNSUPPORTED_IMAGE')) {
          return { error, file, sourceIndex } as const;
        }
        throw error;
      }
    });

    const accepted: (ValidatedImageFile & { sourceIndex: number; sourceSha256: string })[] = [];
    const rejected: RejectedImportFile[] = [];
    for (const result of results) {
      if ('validated' in result && result.sourceSha256) accepted.push({ ...result.validated, sourceIndex: result.sourceIndex, sourceSha256: result.sourceSha256 });
      else if ('error' in result && result.error && result.file) {
        rejected.push({
          code: result.error.code === 'ORIGINAL_TOO_LARGE' ? 'ORIGINAL_TOO_LARGE' : result.error.code === 'CORRUPT_IMAGE' ? 'CORRUPT_IMAGE' : 'UNSUPPORTED_IMAGE',
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
    const job = await this.requireJob(importId);
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
        const errors = await this.processChunk(chunk, files, encoder, uploadLimiter, abortController.signal, job.keepOriginals === true);
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
      const completedJob = await this.requireJob(importId);
      await this.saveJobState(completedJob, 'completed');
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
    keepOriginals: boolean,
  ): Promise<number> {
    const candidates = chunk.photos.filter((photo) => photo.state !== 'finalized');
    const results = await mapWithConcurrency(candidates, 2, async (photo) => {
      try {
        await this.waitForCheckpoint();
        const file = files.get(photo.sourceIndex);
        if (!file) throw new ImageProcessingError('CORRUPT_IMAGE', 'The source file is no longer available for resume.');
        const encoded = await encoder.encode(file);
        const originals = keepOriginals ? [await originalVariant(file, photo)] : [];
        await Promise.all(
          [...encoded.variants, ...originals].map((variant) =>
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

async function originalVariant(file: File, photo: ImportJournalPhoto) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  // The photo declaration describes the displayed orientation; original bytes retain the camera's dimensions.
  const swapsDimensions = (photo.orientation ?? 1) >= 5;
  return {
    blob: file,
    byteSize: file.size,
    checksumSha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    contentType: photo.contentType,
    height: swapsDimensions ? photo.width : photo.height,
    name: 'original' as const,
    width: swapsDimensions ? photo.height : photo.width,
  };
}

function buildChunks(
  importId: string,
  files: (ValidatedImageFile & { sourceIndex: number; sourceSha256: string })[],
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
      orientation: file.orientation,
      sourceIndex: file.sourceIndex,
      sortKey: String(file.sourceIndex).padStart(8, '0'),
      sourceSha256: file.sourceSha256,
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
