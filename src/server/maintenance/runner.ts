import {
  D1MaintenanceRepository,
  parseDeleteFaceVectorPayload,
  parseDeletePhotoPayload,
  parsePurgeExpiredFacesPayload,
  parsePurgeFacesPayload,
} from '../repositories/maintenanceRepository';
import type { MaintenanceJobRecord, MaintenanceRepository } from '../repositories/maintenanceRepository';
import { R2StorageService } from '../services/storage';
import type { StorageService } from '../services/storage';
import { CloudflareVectorDeleteService } from '../services/vectorize';
import type { VectorDeleteService } from '../services/vectorize';

export interface MaintenanceRunnerDependencies {
  now: () => Date;
  repository: MaintenanceRepository;
  storage: StorageService;
  vectors: VectorDeleteService;
}

export class MaintenanceRunner {
  constructor(private readonly dependencies: MaintenanceRunnerDependencies) {}

  async run(limit = 10): Promise<number> {
    let processed = 0;
    while (processed < limit) {
      const now = this.dependencies.now();
      const job = await this.dependencies.repository.claimNext(now.toISOString());
      if (!job) break;

      try {
        await this.process(job, now);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown maintenance failure';
        const delayMs = Math.min(60 * 60 * 1_000, 2 ** job.attempts * 30_000);
        await this.dependencies.repository.retryJob(
          job,
          message,
          new Date(now.getTime() + delayMs).toISOString(),
          now.toISOString(),
        );
      }
      processed += 1;
    }
    return processed;
  }

  private async process(job: MaintenanceJobRecord, now: Date): Promise<void> {
    if (job.kind === 'delete_face_vector') {
      const payload = parseDeleteFaceVectorPayload(job.payload);
      await this.dependencies.vectors.deleteMany([payload.vectorId]);
      await this.dependencies.repository.completeJob(job.id, now.toISOString());
      return;
    }

    if (job.kind === 'delete_photo_media') {
      const payload = parseDeletePhotoPayload(job.payload);
      const cleanup = await this.dependencies.repository.photoCleanupData(payload.photoId);
      await this.dependencies.storage.deleteMany(cleanup.storageKeys);
      await this.dependencies.vectors.deleteMany(cleanup.vectorIds);
      await this.dependencies.repository.completePhotoDeletion(job.id, payload.photoId, now.toISOString());
      return;
    }

    if (job.kind === 'purge_event_faces') {
      const payload = parsePurgeFacesPayload(job.payload);
      const vectorIds = await this.dependencies.repository.eventFaceVectorIds(payload.eventId);
      await this.dependencies.vectors.deleteMany(vectorIds);
      await this.dependencies.repository.completeEventFacePurge(job.id, payload.eventId, now.toISOString());
      return;
    }

    if (job.kind === 'purge_expired_faces') {
      const payload = parsePurgeExpiredFacesPayload(job.payload);
      const vectorIds = await this.dependencies.repository.expiredFaceVectorIds(
        payload.eventId,
        payload.expiresBefore,
      );
      await this.dependencies.vectors.deleteMany(vectorIds);
      await this.dependencies.repository.completeExpiredFacePurge(
        job.id,
        payload.eventId,
        payload.expiresBefore,
        now.toISOString(),
      );
      return;
    }

    await this.dependencies.repository.reconcileUsage(now.toISOString());
    await this.dependencies.repository.completeJob(job.id, now.toISOString());
  }
}

export async function runMaintenance(bindings: CloudflareBindings, limit = 10): Promise<number> {
  const runner = new MaintenanceRunner({
    now: () => new Date(),
    repository: new D1MaintenanceRepository(bindings.DB),
    storage: new R2StorageService(bindings.MEDIA_BUCKET),
    vectors: new CloudflareVectorDeleteService(bindings.FACE_INDEX),
  });
  return runner.run(limit);
}
