import type { MediaParams } from '../../shared/schemas';

export interface MediaRecord {
  access: 'protected' | 'public';
  accessVersion: number | null;
  allowDownloads: boolean;
  byteSize: number;
  contentType: string;
  filename: string;
  storageKey: string;
}

interface MediaRow {
  access: 'protected' | 'public';
  access_version: number | null;
  allow_downloads: number;
  byte_size: number;
  content_type: string;
  filename: string;
  storage_key: string;
}

export interface MediaRepository {
  findPublishedVariant(params: MediaParams): Promise<MediaRecord | null>;
}

export class D1MediaRepository implements MediaRepository {
  constructor(private readonly database: D1Database) {}

  async findPublishedVariant(params: MediaParams): Promise<MediaRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT e.access, ec.access_version, e.allow_downloads,
                p.filename, pv.storage_key, pv.content_type, pv.byte_size
           FROM photos p
           JOIN events e ON e.id = p.event_id
           JOIN photo_variants pv ON pv.photo_id = p.id
      LEFT JOIN event_credentials ec ON ec.event_id = e.id
          WHERE e.id = ?1
            AND p.id = ?2
            AND p.revision = ?3
            AND pv.variant = ?4
            AND p.state = 'published'
            AND e.visibility IN ('published', 'unlisted')
            AND e.offline_at IS NULL
          LIMIT 1`,
      )
      .bind(params.eventId, params.photoId, params.revision, params.variant)
      .first<MediaRow>();

    if (!row) return null;

    return {
      access: row.access,
      accessVersion: row.access_version,
      allowDownloads: row.allow_downloads === 1,
      byteSize: row.byte_size,
      contentType: row.content_type,
      filename: row.filename,
      storageKey: row.storage_key,
    };
  }
}
