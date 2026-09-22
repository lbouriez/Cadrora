import { describe, expect, it, vi } from 'vitest';

import { MaintenanceRunner } from '../../../src/server/maintenance/runner';
import type {
  MaintenanceJobRecord,
  MaintenanceRepository,
} from '../../../src/server/repositories/maintenanceRepository';
import type { StorageService } from '../../../src/server/services/storage';
import type { VectorDeleteService } from '../../../src/server/services/vectorize';
import { CloudflareVectorDeleteService } from '../../../src/server/services/vectorize';

function repositoryFor(job: MaintenanceJobRecord) {
  let claimed = false;
  const completePhotoDeletion = vi.fn();
  const completeExpiredFacePurge = vi.fn();
  const completeGalleryDeletion = vi.fn();
  const completeJob = vi.fn();
  const expiredFaceVectorIds = vi.fn().mockResolvedValue([]);
  const retryJob = vi.fn();
  const repository: MaintenanceRepository = {
    claimNext: vi.fn().mockImplementation(() => {
      if (claimed) return Promise.resolve(null);
      claimed = true;
      return Promise.resolve(job);
    }),
    completeEventFacePurge: vi.fn(),
    completeExpiredFacePurge,
    completeGalleryDeletion,
    completeJob,
    completePhotoDeletion,
    eventFaceVectorIds: vi.fn().mockResolvedValue([]),
    expiredFaceVectorIds,
    galleryCleanupData: vi.fn().mockResolvedValue({ storageKeys: ['gallery/a'], vectorIds: ['gallery-v'] }),
    photoCleanupData: vi.fn().mockResolvedValue({ storageKeys: ['a', 'b'], vectorIds: ['v'] }),
    reconcileUsage: vi.fn(),
    retryJob,
  };
  return { completeExpiredFacePurge, completeGalleryDeletion, completeJob, completePhotoDeletion, expiredFaceVectorIds, repository, retryJob };
}

describe('maintenance runner', () => {
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

  it('purges gallery providers before deleting its D1 records', async () => {
    const job: MaintenanceJobRecord = {
      attempts: 1,
      id: 'job-gallery',
      kind: 'delete_gallery',
      payload: { eventId: 'event-1' },
    };
    const { completeGalleryDeletion, repository } = repositoryFor(job);
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
    expect(deleteVectors).toHaveBeenCalledWith(['gallery-v']);
    expect(completeGalleryDeletion).toHaveBeenCalledWith(
      'job-gallery',
      'event-1',
      '2030-01-01T00:00:00.000Z',
    );
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
