import { describe, expect, it, vi } from 'vitest';

import { MaintenanceRunner } from '../../../src/server/maintenance/runner';
import type {
  MaintenanceJobRecord,
  MaintenanceRepository,
} from '../../../src/server/repositories/maintenanceRepository';
import type { StorageService } from '../../../src/server/services/storage';
import type { VectorDeleteService } from '../../../src/server/services/vectorize';
import { CloudflareVectorDeleteService } from '../../../src/server/services/vectorize';
import { GALLERY_CLEANUP_BATCH_SIZE } from '../../../src/server/repositories/maintenanceRepository';
import type { GalleryCleanupBatch } from '../../../src/server/repositories/maintenanceRepository';

function repositoryFor(job: MaintenanceJobRecord) {
  let claimed = false;
  const completePhotoDeletion = vi.fn();
  const completeExpiredFacePurge = vi.fn();
  const completeGalleryDeletion = vi.fn();
  const completeGalleryCleanupBatch = vi.fn();
  const completeOriginalCleanupBatch = vi.fn();
  const completeJob = vi.fn();
  const expiredFaceVectorIds = vi.fn().mockResolvedValue([]);
  const retryJob = vi.fn();
  const originalCleanupBatch = vi.fn().mockResolvedValue({ shouldDelete: true, rows: [{ photoId: 'photo-original', storageKey: 'gallery/original' }] });
  const repository: MaintenanceRepository = {
    claimNext: vi.fn().mockImplementation(() => {
      if (claimed) return Promise.resolve(null);
      claimed = true;
      return Promise.resolve(job);
    }),
    completeEventFacePurge: vi.fn(),
    completeExpiredFacePurge,
    completeGalleryDeletion,
    completeGalleryCleanupBatch,
    completeOriginalCleanupBatch,
    completeJob,
    completePhotoDeletion,
    eventFaceVectorIds: vi.fn().mockResolvedValue([]),
    expiredFaceVectorIds,
    galleryCleanupBatch: vi.fn().mockResolvedValue({ kind: 'media', rows: [{ photoId: 'photo-1', variant: 'small', storageKey: 'gallery/a' }] }),
    originalCleanupBatch,
    photoCleanupData: vi.fn().mockResolvedValue({ storageKeys: ['a', 'b'], vectorIds: ['v'] }),
    reconcileUsage: vi.fn(),
    retryJob,
  };
  return { completeExpiredFacePurge, completeGalleryCleanupBatch, completeGalleryDeletion, completeOriginalCleanupBatch, completeJob, completePhotoDeletion, expiredFaceVectorIds, originalCleanupBatch, repository, retryJob };
}

describe('maintenance runner', () => {
  it('keeps a failed gallery cache purge retryable and completes it after success', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 6, id: 'job-cache', kind: 'purge_gallery_cache', payload: { eventId: 'event-1' },
    };
    const first = repositoryFor(job);
    const purgeGalleryCache = vi.fn().mockRejectedValueOnce(new Error('purge rejected')).mockResolvedValue(undefined);
    const dependencies = {
      now: () => new Date('2030-01-01T00:00:00.000Z'),
      storage: { deleteMany: vi.fn(), get: vi.fn() },
      vectors: { deleteMany: vi.fn() },
      purgeGalleryCache,
    };
    await new MaintenanceRunner({ ...dependencies, repository: first.repository }).run();
    expect(first.retryJob).toHaveBeenCalledWith(job, 'purge rejected', expect.any(String), expect.any(String));
    expect(first.completeJob).not.toHaveBeenCalled();

    const second = repositoryFor(job);
    await new MaintenanceRunner({ ...dependencies, repository: second.repository }).run();
    expect(second.completeJob).toHaveBeenCalledWith('job-cache', '2030-01-01T00:00:00.000Z');
  });
  it('does not acknowledge vector cleanup when the configured index is unavailable', async () => {
    const vectors = new CloudflareVectorDeleteService();
    await expect(vectors.deleteMany([])).resolves.toBeUndefined();
    await expect(vectors.deleteMany(['vector-1'])).rejects.toThrow('FACE_INDEX_UNAVAILABLE');
  });

  it('processes a durable single-vector compensation job', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1,
      id: 'job-vector',
      kind: 'delete_face_vector',
      payload: { vectorId: 'vector-orphan' },
    };
    const { completeJob, repository } = repositoryFor(job);
    const deleteMany = vi.fn();
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'),
      repository,
      storage: { deleteMany: vi.fn(), get: vi.fn() },
      vectors: { deleteMany },
    });

    expect(await runner.run()).toBe(1);
    expect(deleteMany).toHaveBeenCalledWith(['vector-orphan']);
    expect(completeJob).toHaveBeenCalledWith('job-vector', '2030-01-01T00:00:00.000Z');
  });

  it('purges providers before marking a photo deleted', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1,
      id: 'job-1',
      kind: 'delete_photo_media',
      payload: { eventId: 'event-1', photoId: 'photo-1' },
    };
    const { completePhotoDeletion, repository } = repositoryFor(job);
    const deleteStorage = vi.fn();
    const deleteVectors = vi.fn();
    const storage: StorageService = { deleteMany: deleteStorage, get: vi.fn() };
    const vectors: VectorDeleteService = { deleteMany: deleteVectors };
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'),
      repository,
      storage,
      vectors,
    });

    expect(await runner.run()).toBe(1);
    expect(deleteStorage).toHaveBeenCalledWith(['a', 'b']);
    expect(deleteVectors).toHaveBeenCalledWith(['v']);
    expect(completePhotoDeletion).toHaveBeenCalledWith(
      'job-1',
      'photo-1',
      '2030-01-01T00:00:00.000Z',
    );
  });

  it('schedules a retry after a provider failure', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 2,
      id: 'job-2',
      kind: 'delete_photo_media',
      payload: { eventId: 'event-1', photoId: 'photo-2' },
    };
    const { repository, retryJob } = repositoryFor(job);
    const storage: StorageService = {
      deleteMany: vi.fn().mockRejectedValue(new Error('R2 unavailable')),
      get: vi.fn(),
    };
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'),
      repository,
      storage,
      vectors: { deleteMany: vi.fn() },
    });

    await runner.run();
    expect(retryJob).toHaveBeenCalledWith(
      job,
      'R2 unavailable',
      '2030-01-01T00:02:00.000Z',
      '2030-01-01T00:00:00.000Z',
    );
  });

  it('acknowledges only one gallery media batch after its R2 objects are deleted', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1,
      id: 'job-gallery',
      kind: 'delete_gallery',
      payload: { eventId: 'event-1' },
    };
    const { completeGalleryCleanupBatch, completeGalleryDeletion, repository } = repositoryFor(job);
    const deleteStorage = vi.fn();
    const deleteVectors = vi.fn();
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'),
      repository,
      storage: { deleteMany: deleteStorage, get: vi.fn() },
      vectors: { deleteMany: deleteVectors },
    });

    expect(await runner.run()).toBe(1);
    expect(deleteStorage).toHaveBeenCalledWith(['gallery/a']);
    expect(deleteVectors).not.toHaveBeenCalled();
    expect(completeGalleryCleanupBatch).toHaveBeenCalledWith(
      'job-gallery',
      'event-1',
      { kind: 'media', rows: [{ photoId: 'photo-1', variant: 'small', storageKey: 'gallery/a' }] },
      '2030-01-01T00:00:00.000Z',
    );
    expect(completeGalleryDeletion).not.toHaveBeenCalled();
  });

  it('resumes a large gallery after a provider failure without losing its D1 progress', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1, id: 'job-large', kind: 'delete_gallery', payload: { eventId: 'event-large' },
    };
    const { repository, retryJob, completeGalleryDeletion } = repositoryFor(job);
    const pending = Array.from({ length: GALLERY_CLEANUP_BATCH_SIZE * 2 + 7 }, (_, index) => `events/event-large/photos/photo-${index}/0/small.webp`);
    const galleryCleanupBatch = vi.fn().mockImplementation(() => Promise.resolve(pending.length === 0
      ? { kind: 'complete' }
      : { kind: 'media', rows: pending.slice(0, GALLERY_CLEANUP_BATCH_SIZE).map((storageKey) => ({ photoId: 'photo', variant: 'small', storageKey })) }));
    repository.galleryCleanupBatch = galleryCleanupBatch;
    repository.claimNext = vi.fn().mockResolvedValue(job);
    repository.completeGalleryCleanupBatch = vi.fn().mockImplementation((
      _jobId: string, _eventId: string, batch: Exclude<GalleryCleanupBatch, { kind: 'complete' }>,
    ) => {
      if (batch.kind !== 'media') throw new Error('Expected media batch');
      pending.splice(0, batch.rows.length);
      return Promise.resolve();
    });
    let call = 0;
    const batchSizes: number[] = [];
    const deleteMany = vi.fn().mockImplementation((keys: string[]) => {
      call += 1;
      batchSizes.push(keys.length);
      if (keys.length > GALLERY_CLEANUP_BATCH_SIZE) throw new Error('Oversized batch');
      return call === 2 ? Promise.reject(new Error('R2 unavailable')) : Promise.resolve();
    });
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'), repository,
      storage: { deleteMany, get: vi.fn() }, vectors: { deleteMany: vi.fn() },
    });

    await runner.run(1);
    expect(pending).toHaveLength(GALLERY_CLEANUP_BATCH_SIZE + 7);
    await runner.run(1);
    expect(retryJob).toHaveBeenCalledWith(job, 'R2 unavailable', expect.any(String), expect.any(String));
    expect(pending).toHaveLength(GALLERY_CLEANUP_BATCH_SIZE + 7);
    await runner.run(1);
    await runner.run(1);
    await runner.run(1);
    expect(pending).toHaveLength(0);
    expect(batchSizes.every((size) => size <= GALLERY_CLEANUP_BATCH_SIZE)).toBe(true);
    expect(completeGalleryDeletion).toHaveBeenCalledOnce();
  });

  it('keeps gallery face rows until Vectorize confirms their deletion', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 2, id: 'job-faces', kind: 'delete_gallery', payload: { eventId: 'event-1' },
    };
    const { repository, retryJob, completeGalleryCleanupBatch } = repositoryFor(job);
    repository.galleryCleanupBatch = vi.fn().mockResolvedValue({
      kind: 'faces', rows: [{ id: 'face-1', vectorId: 'vector-1' }],
    });
    const deleteMany = vi.fn().mockRejectedValue(new Error('Vectorize unavailable'));
    await new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'), repository,
      storage: { deleteMany: vi.fn(), get: vi.fn() }, vectors: { deleteMany },
    }).run();
    expect(deleteMany).toHaveBeenCalledWith(['vector-1']);
    expect(completeGalleryCleanupBatch).not.toHaveBeenCalled();
    expect(retryJob).toHaveBeenCalledOnce();
  });

  it('deletes only original R2 objects before removing their D1 rows', async () => {
    const job: MaintenanceJobRecord = { attempts: 1, id: 'job-originals', kind: 'delete_gallery_originals', payload: { eventId: 'gallery-1' } };
    const { completeOriginalCleanupBatch, repository } = repositoryFor(job);
    const deleteStorage = vi.fn();
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'), repository,
      storage: { deleteMany: deleteStorage, get: vi.fn() }, vectors: { deleteMany: vi.fn() },
    });
    expect(await runner.run()).toBe(1);
    expect(deleteStorage).toHaveBeenCalledWith(['gallery/original']);
    expect(completeOriginalCleanupBatch).toHaveBeenCalledWith('job-originals', [
      { photoId: 'photo-original', storageKey: 'gallery/original' },
    ], '2030-01-01T00:00:00.000Z');
  });

  it('does not delete originals after delivery is enabled again', async () => {
    const job: MaintenanceJobRecord = { attempts: 1, id: 'job-originals', kind: 'delete_gallery_originals', payload: { eventId: 'gallery-1' } };
    const { completeJob, originalCleanupBatch, repository } = repositoryFor(job);
    originalCleanupBatch.mockResolvedValue({ shouldDelete: false, rows: [] });
    const deleteStorage = vi.fn();
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:00:00.000Z'), repository,
      storage: { deleteMany: deleteStorage, get: vi.fn() }, vectors: { deleteMany: vi.fn() },
    });
    expect(await runner.run()).toBe(1);
    expect(deleteStorage).not.toHaveBeenCalled();
    expect(completeJob).toHaveBeenCalledWith('job-originals', '2030-01-01T00:00:00.000Z');
  });

  it('deletes only the expired vector batch before completing its D1 purge', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1,
      id: 'job-expired',
      kind: 'purge_expired_faces',
      payload: {
        eventId: 'event-1',
        expiresBefore: '2030-01-01T00:00:00.000Z',
      },
    };
    const { completeExpiredFacePurge, expiredFaceVectorIds, repository } = repositoryFor(job);
    expiredFaceVectorIds.mockResolvedValue(['expired-vector']);
    const deleteMany = vi.fn();
    const runner = new MaintenanceRunner({
      now: () => new Date('2030-01-01T00:05:00.000Z'),
      repository,
      storage: { deleteMany: vi.fn(), get: vi.fn() },
      vectors: { deleteMany },
    });

    expect(await runner.run()).toBe(1);
    expect(expiredFaceVectorIds).toHaveBeenCalledWith('event-1', '2030-01-01T00:00:00.000Z');
    expect(deleteMany).toHaveBeenCalledWith(['expired-vector']);
    expect(completeExpiredFacePurge).toHaveBeenCalledWith(
      'job-expired',
      'event-1',
      '2030-01-01T00:00:00.000Z',
      '2030-01-01T00:05:00.000Z',
    );
  });
});
