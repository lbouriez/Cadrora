import type { AcceptedSourceImageType, ExifOrientation } from '../images';

export type ImportJobState = 'cancelled' | 'completed' | 'paused' | 'processing';
export type ImportChunkJournalState = 'finalized' | 'pending' | 'uploading' | 'failed';
export type ImportPhotoJournalState = 'finalized' | 'pending' | 'failed';

export interface ImportJournalJob {
  createdAt: string;
  eventId: string;
  id: string;
  keepOriginals?: boolean;
  replacementPhotoId?: string;
  state: ImportJobState;
  totalPhotos: number;
  updatedAt: string;
}

export interface ImportJournalPhoto {
  capturedAt?: string;
  contentType: AcceptedSourceImageType;
  errorCode?: string;
  filename: string;
  height: number;
  id: string;
  orientation?: ExifOrientation;
  sourceIndex: number;
  sortKey: string;
  sourceSha256?: string;
  state: ImportPhotoJournalState;
  width: number;
}

export interface ImportJournalChunk {
  importId: string;
  number: number;
  photos: ImportJournalPhoto[];
  state: ImportChunkJournalState;
  updatedAt: string;
}

export interface JournalFile {
  file: File;
  importId: string;
  sourceIndex: number;
}

export interface NewImportJournal {
  chunks: ImportJournalChunk[];
  files: JournalFile[];
  job: ImportJournalJob;
}

export interface ImportJournal {
  create(value: NewImportJournal): Promise<void>;
  getChunks(importId: string): Promise<ImportJournalChunk[]>;
  getFiles(importId: string, sourceIndexes: number[]): Promise<Map<number, File>>;
  getJob(importId: string): Promise<ImportJournalJob | undefined>;
  getNextUnfinishedChunk(importId: string): Promise<ImportJournalChunk | undefined>;
  getResumable(eventId: string, replacementPhotoId?: string): Promise<ImportJournalJob | undefined>;
  saveChunk(chunk: ImportJournalChunk): Promise<void>;
  saveJob(job: ImportJournalJob): Promise<void>;
}

const DATABASE_NAME = 'cadrora-import-journal';
const DATABASE_VERSION = 1;
const JOB_STORE = 'jobs';
const CHUNK_STORE = 'chunks';
const FILE_STORE = 'files';

/** IndexedDB keeps browser-side source files and durable 50-photo work journals for resume. */
export class IndexedDbImportJournal implements ImportJournal {
  private constructor(private readonly database: IDBDatabase) {}

  static async open(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IndexedDbImportJournal> {
    if (!factory) throw new Error('IndexedDB is unavailable; import resume cannot be enabled.');
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const jobs = database.createObjectStore(JOB_STORE, { keyPath: 'id' });
      jobs.createIndex('eventId', 'eventId', { unique: false });
      database.createObjectStore(CHUNK_STORE, { keyPath: ['importId', 'number'] });
      database.createObjectStore(FILE_STORE, { keyPath: ['importId', 'sourceIndex'] });
    };
    return new IndexedDbImportJournal(await requestToPromise(request));
  }

  async create(value: NewImportJournal): Promise<void> {
    await this.transaction([JOB_STORE, CHUNK_STORE, FILE_STORE], 'readwrite', (stores) => {
      stores[JOB_STORE]!.put(value.job);
      for (const chunk of value.chunks) stores[CHUNK_STORE]!.put(chunk);
      for (const file of value.files) stores[FILE_STORE]!.put(file);
    });
  }

  async getChunks(importId: string): Promise<ImportJournalChunk[]> {
    const chunks = await this.request<ImportJournalChunk[]>(CHUNK_STORE, 'readonly', (store) =>
      readAll<ImportJournalChunk>(store),
    );
    return chunks.filter((chunk) => chunk.importId === importId).sort((left, right) => left.number - right.number);
  }

  async getFiles(importId: string, sourceIndexes: number[]): Promise<Map<number, File>> {
    const records = await this.request<JournalFile[]>(FILE_STORE, 'readonly', (store) =>
      readAll<JournalFile>(store),
    );
    const needed = new Set(sourceIndexes);
    return new Map(
      records
        .filter((record) => record.importId === importId && needed.has(record.sourceIndex))
        .map((record) => [record.sourceIndex, record.file]),
    );
  }

  async getJob(importId: string): Promise<ImportJournalJob | undefined> {
    return this.request<ImportJournalJob | undefined>(JOB_STORE, 'readonly', (store) =>
      readOne<ImportJournalJob | undefined>(store, importId),
    );
  }

  async getNextUnfinishedChunk(importId: string): Promise<ImportJournalChunk | undefined> {
    return (await this.getChunks(importId)).find((chunk) => chunk.state !== 'finalized');
  }

  async getResumable(eventId: string, replacementPhotoId?: string): Promise<ImportJournalJob | undefined> {
    const jobs = await this.request<ImportJournalJob[]>(JOB_STORE, 'readonly', (store) =>
      readAllFromIndex<ImportJournalJob>(store.index('eventId'), eventId),
    );
    return jobs
      .filter((job) => (job.state === 'processing' || job.state === 'paused') && job.replacementPhotoId === replacementPhotoId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async saveChunk(chunk: ImportJournalChunk): Promise<void> {
    await this.request<IDBValidKey>(CHUNK_STORE, 'readwrite', (store) => store.put(chunk));
  }

  async saveJob(job: ImportJournalJob): Promise<void> {
    await this.request<IDBValidKey>(JOB_STORE, 'readwrite', (store) => store.put(job));
  }

  private async request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const transaction = this.database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    const [value] = await Promise.all([requestToPromise(request), transactionToPromise(transaction)]);
    return value;
  }

  private async transaction(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (stores: Record<string, IDBObjectStore | undefined>) => void,
  ): Promise<void> {
    const transaction = this.database.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    operation(stores);
    await transactionToPromise(transaction);
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

// IndexedDB exposes `any` result payloads. These are the sole typed boundary;
// persisted values are produced by this module before being read back.
function readAll<T>(store: IDBObjectStore): IDBRequest<T[]> {
  return store.getAll() as IDBRequest<T[]>;
}

function readAllFromIndex<T>(index: IDBIndex, key: IDBValidKey): IDBRequest<T[]> {
  return index.getAll(key) as IDBRequest<T[]>;
}

function readOne<T>(store: IDBObjectStore, key: IDBValidKey): IDBRequest<T> {
  return store.get(key) as IDBRequest<T>;
}
