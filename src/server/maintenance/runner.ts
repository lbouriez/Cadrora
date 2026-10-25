import {
  D1MaintenanceRepository,
  parseDeleteFaceVectorPayload,
  parseDeleteGalleryPayload,
  parseDeleteGalleryOriginalsPayload,
  parseDeletePhotoPayload,
  parseDeletePortfolioMediaPayload,
  parseDeleteReplacedMediaPayload,
  parseDeleteServiceMediaPayload,
  parsePurgeExpiredFacesPayload,
  parsePurgeFacesPayload,
  parsePurgeGalleryCachePayload,
} from '../repositories/maintenanceRepository';
import type { MaintenanceJobRecord, MaintenanceRepository } from '../repositories/maintenanceRepository';
import { R2StorageService } from '../services/storage';
import type { StorageService } from '../services/storage';
import { CloudflareVectorDeleteService } from '../services/vectorize';
import type { VectorDeleteService } from '../services/vectorize';
import { purgePublicMediaCache } from '../services/publicMediaCache';
import { recordAppLog } from '../services/appLog';

export interface MaintenanceRunnerDependencies {
  now: () => Date;
  repository: MaintenanceRepository;
  storage: StorageService;
  vectors: VectorDeleteService;
  purgeGalleryCache?: ((eventId: string) => Promise<void>) | undefined;
  onFailure?: (job: MaintenanceJobRecord) => Promise<void>;
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
      } catch {
        // Provider exceptions can contain media keys or credentials. Persist a
        // classified code; never copy their message into jobs or application logs.
        const message = 'MAINTENANCE_OPERATION_FAILED';
        const delayMs = Math.min(60 * 60 * 1_000, 2 ** job.attempts * 30_000);
        await this.dependencies.repository.retryJob(
          job,
          message,
          new Date(now.getTime() + delayMs).toISOString(),
          now.toISOString(),
        );
        // An optional telemetry sink must not interrupt subsequent cleanup jobs.
        try { await this.dependencies.onFailure?.(job); } catch { /* best effort */ }
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

    if (job.kind === 'delete_replaced_media') {
      const payload = parseDeleteReplacedMediaPayload(job.payload);
      await this.dependencies.storage.deleteMany(payload.storageKeys);
      await this.dependencies.repository.completeJob(job.id, now.toISOString());
      return;
    }

    if (job.kind === 'delete_service_media') {
      const payload = parseDeleteServiceMediaPayload(job.payload);
      await this.dependencies.storage.deleteMany(payload.storageKeys);
      await this.dependencies.repository.completeJob(job.id, now.toISOString());
      return;
    }

    if (job.kind === 'delete_portfolio_media') {
      const payload = parseDeletePortfolioMediaPayload(job.payload);
      await this.dependencies.storage.deleteMany(payload.storageKeys);
      await this.dependencies.repository.completeJob(job.id, now.toISOString());
      return;
    }

    if (job.kind === 'delete_gallery') {
      const payload = parseDeleteGalleryPayload(job.payload);
      const batch = await this.dependencies.repository.galleryCleanupBatch(payload.eventId);
      if (batch.kind === 'complete') {
        await this.dependencies.repository.completeGalleryDeletion(job.id, payload.eventId, now.toISOString());
        return;
      }
      if (batch.kind === 'media') {
        await this.dependencies.storage.deleteMany(batch.rows.map((row) => row.storageKey));
      } else if (batch.kind === 'faces') {
        await this.dependencies.vectors.deleteMany(batch.rows.map((row) => row.vectorId));
      }
      await this.dependencies.repository.completeGalleryCleanupBatch(job.id, payload.eventId, batch, now.toISOString());
      return;
    }

    if (job.kind === 'delete_gallery_originals') {
      const payload = parseDeleteGalleryOriginalsPayload(job.payload);
      const batch = await this.dependencies.repository.originalCleanupBatch(payload.eventId);
      if (!batch.shouldDelete) {
        await this.dependencies.repository.completeJob(job.id, now.toISOString());
        return;
      }
      await this.dependencies.storage.deleteMany(batch.rows.map((row) => row.storageKey));
      await this.dependencies.repository.completeOriginalCleanupBatch(job.id, batch.rows, now.toISOString());
      return;
    }

    if (job.kind === 'purge_event_faces') {
      const payload = parsePurgeFacesPayload(job.payload);
      const vectorIds = await this.dependencies.repository.eventFaceVectorIds(payload.eventId);
      await this.dependencies.vectors.deleteMany(vectorIds);
      await this.dependencies.repository.completeEventFacePurge(job.id, payload.eventId, now.toISOString());
      return;
    }

    if (job.kind === 'purge_gallery_cache') {
      const payload = parsePurgeGalleryCachePayload(job.payload);
      if (!this.dependencies.purgeGalleryCache) throw new Error('PUBLIC_MEDIA_CACHE_PURGE_UNAVAILABLE');
      await this.dependencies.purgeGalleryCache(payload.eventId);
      await this.dependencies.repository.completeJob(job.id, now.toISOString());
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

export async function runMaintenance(bindings: CloudflareBindings, limit = 10, executionContext?: ExecutionContext): Promise<number> {
  const runner = new MaintenanceRunner({
    now: () => new Date(),
    repository: new D1MaintenanceRepository(bindings.DB),
    storage: new R2StorageService(bindings.MEDIA_BUCKET),
    vectors: new CloudflareVectorDeleteService(bindings.FACE_INDEX),
    purgeGalleryCache: executionContext ? (eventId) => purgePublicMediaCache(executionContext, eventId) : undefined,
    onFailure: (job) => recordAppLog(bindings.DB, {
      level: job.attempts >= 5 && job.kind !== 'delete_gallery' && job.kind !== 'purge_gallery_cache' ? 'error' : 'warn',
      source: 'maintenance', code: 'MAINTENANCE_OPERATION_FAILED', category: 'maintenance',
      requestId: crypto.randomUUID(), method: 'SCHEDULED', routeGroup: 'maintenance', jobId: job.id, jobKind: job.kind,
    }),
  });
  return runner.run(limit);
}
