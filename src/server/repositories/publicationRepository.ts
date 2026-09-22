import type { PublicationState, PublicationSummary, UsageSnapshot } from '../../shared/schemas';

interface CountRow {
  total: number;
}

interface PublicationRow {
  indexing_photos: number;
  published_at: string | null;
  published_photos: number;
  ready_photos: number;
  total_photos: number;
  visibility: PublicationSummary['visibility'];
  offline_at: string | null;
}

const FACE_INDEX_LEASE_MS = 15 * 60_000;

export interface PublicationRepository {
  deletePhoto(photoId: string, now: string): Promise<boolean>;
  updatePublication(eventId: string, state: PublicationState, now: string): Promise<PublicationUpdateResult>;
  publicationSummary(eventId: string, publishedAt?: string | null): Promise<PublicationSummary | null>;
  usage(now: string): Promise<UsageSnapshot>;
}

export type PublicationUpdateResult =
  | { status: 'updated'; summary: PublicationSummary }
  | { status: 'not-found' | 'not-ready' | 'not-published' };

export class D1PublicationRepository implements PublicationRepository {
  constructor(private readonly database: D1Database) {}

  async deletePhoto(photoId: string, now: string): Promise<boolean> {
    const photo = await this.database
      .prepare("SELECT id, event_id FROM photos WHERE id = ?1 AND state NOT IN ('deleting', 'deleted') LIMIT 1")
      .bind(photoId)
      .first<{ event_id: string; id: string }>();
    if (!photo) return false;

    const jobId = crypto.randomUUID();
    const staleBefore = new Date(Date.parse(now) - FACE_INDEX_LEASE_MS).toISOString();
    const results = await this.database.batch([
      this.database
        .prepare(
          `UPDATE photos
              SET state = 'deleting', face_state = 'deleting', updated_at = ?2
            WHERE id = ?1
              AND state NOT IN ('deleting', 'deleted')
              AND (face_state <> 'indexing' OR updated_at <= ?3)`,
        )
        .bind(photoId, now, staleBefore),
      this.database
        .prepare(
          `INSERT INTO maintenance_jobs
             (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
           SELECT ?1, 'delete_photo_media', 'pending', ?2, ?3, 0, ?4, ?4, ?4
            WHERE EXISTS (
              SELECT 1 FROM photos WHERE id = ?5 AND state = 'deleting' AND updated_at = ?4
            )
           ON CONFLICT(idempotency_key) DO NOTHING`,
        )
        .bind(jobId, JSON.stringify({ eventId: photo.event_id, photoId }), `delete-photo:${photoId}`, now, photoId),
    ]);
    return (results[0]?.meta.changes ?? 0) === 1;
  }

  async updatePublication(eventId: string, state: PublicationState, now: string): Promise<PublicationUpdateResult> {
    const before = await this.publicationSummary(eventId);
    if (!before) return { status: 'not-found' };
    const currentState = before.offlineAt ? 'offline' : before.visibility;
    if (currentState === state) return { status: 'updated', summary: before };
    if (state === 'offline' && before.visibility === 'draft') return { status: 'not-published' };
    if (state !== 'offline' && (before.totalPhotos === 0 || before.readyPhotos !== before.totalPhotos)) {
      return { status: 'not-ready' };
    }

    const statements: D1PreparedStatement[] = [];
    if (state === 'offline') {
      statements.push(
        this.database
          .prepare('UPDATE events SET offline_at = ?2, revision = revision + 1, updated_at = ?2 WHERE id = ?1')
          .bind(eventId, now),
        this.database
          .prepare('UPDATE event_credentials SET access_version = access_version + 1, updated_at = ?2 WHERE event_id = ?1')
          .bind(eventId, now),
      );
    } else {
      statements.push(this.database
        .prepare("UPDATE photos SET state = 'published', updated_at = ?2 WHERE event_id = ?1 AND state = 'variants_ready'")
        .bind(eventId, now));
      statements.push(this.database
        .prepare('UPDATE events SET visibility = ?2, offline_at = NULL, revision = revision + 1, updated_at = ?3 WHERE id = ?1')
        .bind(eventId, state, now));
    }
    await this.database.batch(statements);

    const summary = await this.publicationSummary(eventId, state === 'offline' ? null : now);
    return summary ? { status: 'updated', summary } : { status: 'not-found' };
  }

  async usage(now: string): Promise<UsageSnapshot> {
    const [events, photos, storage, faces, vectorDimensions] = await Promise.all([
      this.count('SELECT COUNT(*) AS total FROM events'),
      this.count("SELECT COUNT(*) AS total FROM photos WHERE state != 'deleted'"),
      this.count(
        `SELECT COALESCE(SUM(pv.byte_size), 0) AS total
           FROM photo_variants pv
           JOIN photos p ON p.id = pv.photo_id
          WHERE p.state != 'deleted'`,
      ),
      this.count('SELECT COUNT(*) AS total FROM faces'),
      this.database
        .prepare("SELECT value AS total FROM usage_counters WHERE key = 'vector_dimensions_queried'")
        .first<CountRow>()
        .then((row) => row?.total ?? 0),
    ]);

    return {
      capturedAt: now,
      events,
      photos,
      storageBytes: storage,
      faces,
      vectorDimensionsQueried: vectorDimensions,
    };
  }

  private async count(sql: string): Promise<number> {
    return (await this.database.prepare(sql).first<CountRow>())?.total ?? 0;
  }

  async publicationSummary(eventId: string, publishedAt?: string | null): Promise<PublicationSummary | null> {
    const row = await this.database
      .prepare(
        `SELECT COUNT(*) AS total_photos,
                SUM(CASE WHEN state IN ('variants_ready', 'published') THEN 1 ELSE 0 END) AS ready_photos,
                SUM(CASE WHEN state = 'published' THEN 1 ELSE 0 END) AS published_photos,
                SUM(CASE WHEN face_state IN ('pending', 'indexing') THEN 1 ELSE 0 END) AS indexing_photos,
                (SELECT CASE WHEN visibility != 'draft' AND offline_at IS NULL THEN updated_at ELSE NULL END FROM events WHERE id = ?1) AS published_at,
                (SELECT visibility FROM events WHERE id = ?1) AS visibility,
                (SELECT offline_at FROM events WHERE id = ?1) AS offline_at
           FROM photos
          WHERE event_id = ?1 AND state NOT IN ('deleting', 'deleted')
         HAVING EXISTS (SELECT 1 FROM events WHERE id = ?1)`,
      )
      .bind(eventId)
      .first<PublicationRow>();
    if (!row) return null;

    return {
      eventId,
      totalPhotos: row.total_photos,
      readyPhotos: row.ready_photos,
      publishedPhotos: row.published_photos,
      indexingPhotos: row.indexing_photos,
      publishedAt: publishedAt === undefined ? row.published_at : publishedAt,
      visibility: row.visibility,
      offlineAt: row.offline_at,
    };
  }
}
